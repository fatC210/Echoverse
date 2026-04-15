import {
  resolveLlmSettings,
  type EchoSettings,
} from "@/lib/constants/defaults";
import { createEmbeddings, LlmRequestError } from "@/lib/services/llm";
import {
  queryNamespace,
  writeNamespaceRows,
} from "@/lib/services/turbopuffer";
import type {
  AudioAsset,
  Decision,
  PlayerProfile,
  SegmentGenerationInput,
  Story,
  StoryRetrievalContext,
  StoryRetrievalMatch,
} from "@/lib/types/echoverse";

type MemoryRowType =
  | "character"
  | "location"
  | "item"
  | "event_trigger"
  | "sonic_dna"
  | "decision"
  | "audio_asset"
  | "player_profile";

type MemoryRow = {
  id: string;
  type: MemoryRowType;
  text: string;
  label: string;
  entity_id?: string;
  asset_id?: string;
  category?: AudioAsset["category"];
  risk_level?: Decision["riskLevel"];
  trait_signal?: string;
  tags?: string[];
  timestamp?: string;
  updated_at?: string;
  times_used?: number;
  total_decisions?: number;
  score_snapshot?: number;
  vector?: number[];
};

type QueryRow = {
  id: string;
  $dist?: number;
  type?: string;
  text?: string;
  label?: string;
  entity_id?: string;
  asset_id?: string;
  category?: string;
  risk_level?: string;
  trait_signal?: string;
  timestamp?: string;
};

type QueryResponse = {
  rows?: QueryRow[];
  results?: Array<{ rows?: QueryRow[] }>;
};

const RETRIEVAL_TYPES = ["location", "character", "item", "event_trigger", "sonic_dna"] as const;
const AUDIO_CACHE_TYPES = ["audio_asset"] as const;
const disabledEmbeddingConfigs = new Set<string>();
const warnedEmbeddingConfigs = new Set<string>();
const warnedTurbopufferConfigs = new Set<string>();

function getEmbeddingConfigKey(settings: EchoSettings) {
  const resolved = resolveLlmSettings(settings.llm);
  return `${resolved.baseUrl}|${resolved.embeddingModel}`;
}

function getTurbopufferConfigKey(settings: EchoSettings) {
  return `${settings.turbopuffer.baseUrl.trim()}|${settings.turbopuffer.apiKey.trim()}`;
}

function canUseTurbopuffer(settings: EchoSettings) {
  return Boolean(settings.turbopuffer.apiKey.trim());
}

function shouldDisableEmbeddings(error: unknown) {
  if (error instanceof LlmRequestError) {
    return error.status >= 400 && error.status < 500;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /embedding|configuration|missing|not found|unsupported|model/i.test(message);
}

function warnOnce(cache: Set<string>, key: string, message: string, meta?: Record<string, unknown>) {
  if (cache.has(key)) {
    return;
  }

  cache.add(key);
  console.warn(message, meta);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isMissingFilterAttributeError(error: unknown, attribute: string) {
  const message = getErrorMessage(error);
  return message.includes(`filter error in key \`${attribute}\`: attribute not found`);
}

async function embedTexts(settings: EchoSettings, texts: string[]) {
  if (!texts.length) {
    return [] as number[][];
  }

  const configKey = getEmbeddingConfigKey(settings);

  if (disabledEmbeddingConfigs.has(configKey)) {
    return [] as number[][];
  }

  try {
    const embeddings = await createEmbeddings(settings.llm, texts);
    return embeddings.map((embedding) => embedding ?? []);
  } catch (error) {
    if (shouldDisableEmbeddings(error)) {
      disabledEmbeddingConfigs.add(configKey);
    }

    warnOnce(
      warnedEmbeddingConfigs,
      configKey,
      "Embedding lookup unavailable; turbopuffer semantic features are running in degraded mode.",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );

    return [] as number[][];
  }
}

function getStoryNamespace(storyId: string) {
  return `dw_${storyId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function compactText(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function buildNamespaceSchema(vectorLength: number) {
  return {
    vector: { type: `[${vectorLength}]f32`, ann: true },
    text: { type: "string", full_text_search: true },
    tags: { type: "[]string" },
    timestamp: { type: "datetime" },
    updated_at: { type: "datetime" },
  };
}

async function upsertMemoryRows(
  settings: EchoSettings,
  storyId: string,
  rows: MemoryRow[],
) {
  if (!canUseTurbopuffer(settings) || !rows.length) {
    return false;
  }

  const existingVectorLength = rows.find((row) => row.vector?.length)?.vector?.length ?? 0;
  const needsEmbeddings = rows.some((row) => !row.vector?.length);
  const embeddings = needsEmbeddings
    ? await embedTexts(
        settings,
        rows.map((row) => row.text),
      )
    : [];
  const vectorLength =
    existingVectorLength || embeddings.find((embedding) => embedding.length)?.length || 0;

  if (!vectorLength) {
    return false;
  }

  const payload = rows.map((row, index) => ({
    ...row,
    vector:
      row.vector?.length === vectorLength
        ? row.vector
        : embeddings[index]?.length === vectorLength
          ? embeddings[index]
          : null,
  }));

  try {
    await writeNamespaceRows(
      settings.turbopuffer,
      getStoryNamespace(storyId),
      payload,
      {
        distance_metric: "cosine_distance",
        schema: buildNamespaceSchema(vectorLength),
      },
    );

    return true;
  } catch (error) {
    warnOnce(
      warnedTurbopufferConfigs,
      getTurbopufferConfigKey(settings),
      "turbopuffer write failed; local fallbacks remain active.",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );

    return false;
  }
}

function getStoryTags(story: Story) {
  return [
    story.genre,
    ...story.tags.preset,
    ...story.tags.custom,
  ].filter(Boolean);
}

function buildWorldRows(story: Story): MemoryRow[] {
  const tags = getStoryTags(story);
  const rows: MemoryRow[] = [];
  const updatedAt = story.updatedAt;

  rows.push({
    id: "sonic_dna:core",
    type: "sonic_dna",
    label: `${story.title} sonic DNA`,
    text: compactText(
      [
        `World title: ${story.title}.`,
        `Premise: ${story.premise}.`,
        `Tone: ${story.worldState.tone}.`,
        `Setting: ${story.worldState.setting.location}, ${story.worldState.setting.era}. ${story.worldState.setting.atmosphere}`,
        `Palette: ${story.worldState.sonic_dna.palette.join(", ")}.`,
        `Music style: ${story.worldState.sonic_dna.music_style}.`,
        `Avoid: ${story.worldState.sonic_dna.avoid.join(", ")}.`,
        `Signature sound: ${story.worldState.sonic_dna.signature_sound}.`,
      ].join(" "),
    ),
    entity_id: "sonic_dna:core",
    tags,
    updated_at: updatedAt,
  });

  for (const character of story.worldState.characters) {
    rows.push({
      id: `character:${character.id}`,
      type: "character",
      label: character.name,
      text: compactText(
        [
          `${character.name} is a ${character.role}.`,
          character.personality,
          `Relationship to protagonist: ${character.relationship_to_protagonist}.`,
          `Voice: ${character.voice_description}.`,
        ].join(" "),
      ),
      entity_id: character.id,
      tags,
      updated_at: updatedAt,
    });
  }

  for (const location of story.worldState.locations) {
    rows.push({
      id: `location:${location.id}`,
      type: "location",
      label: location.name,
      text: compactText(
        [
          `${location.name}.`,
          location.description,
          `Atmosphere: ${location.atmosphere}.`,
          `Connected to: ${location.connected_to.join(", ") || "none"}.`,
          `SFX hints: ${location.sfx_hints}.`,
          `Discoverable items: ${location.discoverable_items.join(", ") || "none"}.`,
        ].join(" "),
      ),
      entity_id: location.id,
      tags,
      updated_at: updatedAt,
    });
  }

  for (const item of story.worldState.items) {
    rows.push({
      id: `item:${item.id}`,
      type: "item",
      label: item.name,
      text: compactText(
        [
          `${item.name}.`,
          item.description,
          `Narrative function: ${item.narrative_function}.`,
          `Discoverable: ${item.discoverable ? "yes" : "no"}.`,
        ].join(" "),
      ),
      entity_id: item.id,
      tags,
      updated_at: updatedAt,
    });
  }

  for (const chapter of story.worldState.chapters) {
    rows.push({
      id: `event_trigger:${chapter.id}`,
      type: "event_trigger",
      label: chapter.title,
      text: compactText(
        [
          `Chapter: ${chapter.title}.`,
          chapter.summary,
          `Target mood: ${chapter.target_mood}.`,
          `Target choices: ${chapter.target_choices}.`,
        ].join(" "),
      ),
      entity_id: chapter.id,
      tags,
      updated_at: updatedAt,
    });
  }

  return rows;
}

function buildPlayerProfileRow(story: Story, profile: PlayerProfile): MemoryRow {
  const dominantTrait =
    ([
      ["brave", profile.brave],
      ["cautious", profile.cautious],
      ["empathetic", profile.empathetic],
      ["analytical", profile.analytical],
    ] as Array<[string, number]>).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "balanced";

  return {
    id: "player_profile:current",
    type: "player_profile",
    label: "Current player profile",
    text: compactText(
      [
        `Player profile for ${story.title}.`,
        `Dominant trait: ${dominantTrait}.`,
        `Brave ${profile.brave}, cautious ${profile.cautious}, empathetic ${profile.empathetic}, analytical ${profile.analytical}.`,
        `Preferred pacing: ${profile.preferredPacing}.`,
        `Scare tolerance: ${profile.scareTolerance}.`,
        `Average decision time: ${profile.avgDecisionTimeMs} ms.`,
        `Total decisions: ${profile.totalDecisions}.`,
      ].join(" "),
    ),
    entity_id: "current",
    tags: getStoryTags(story),
    updated_at: profile.updatedAt,
    total_decisions: profile.totalDecisions,
    score_snapshot:
      profile.brave + profile.cautious + profile.empathetic + profile.analytical,
  };
}

function buildDecisionRow(story: Story, decision: Decision): MemoryRow {
  return {
    id: `decision:${decision.id}`,
    type: "decision",
    label: decision.choiceText,
    text: compactText(
      [
        `Choice: ${decision.choiceText}.`,
        `Risk: ${decision.riskLevel}.`,
        `Trait signal: ${decision.traitSignal}.`,
        `Decision time: ${decision.timeToDecideMs} ms.`,
        `Chapter: ${decision.chapterId}.`,
      ].join(" "),
    ),
    entity_id: decision.segmentId,
    risk_level: decision.riskLevel,
    trait_signal: decision.traitSignal,
    tags: getStoryTags(story),
    timestamp: decision.timestamp,
    updated_at: decision.timestamp,
    score_snapshot: decision.timeToDecideMs,
  };
}

function buildAudioAssetRow(asset: AudioAsset): MemoryRow {
  return {
    id: `audio_asset:${asset.id}`,
    type: "audio_asset",
    label: asset.description,
    text: compactText(
      [
        `${asset.category} audio asset.`,
        `Description: ${asset.description}.`,
        `Mood: ${asset.mood}.`,
        `Looping: ${asset.looping ? "yes" : "no"}.`,
        `Duration: ${asset.durationSec} seconds.`,
      ].join(" "),
    ),
    asset_id: asset.id,
    category: asset.category,
    tags: [asset.category, asset.mood].filter(Boolean),
    timestamp: asset.createdAt,
    updated_at: asset.createdAt,
    times_used: asset.timesUsed,
    vector: asset.embedding,
  };
}

function toRetrievalMatch(
  row: QueryRow,
  source: StoryRetrievalMatch["source"],
): StoryRetrievalMatch {
  const score =
    source === "semantic" && typeof row.$dist === "number"
      ? Math.max(0, 1 - row.$dist)
      : row.$dist;

  return {
    id: row.id,
    source,
    type: row.type ?? "unknown",
    entityId: row.entity_id,
    label: row.label ?? row.entity_id ?? row.id,
    text: row.text ?? "",
    score,
    timestamp: row.timestamp,
  };
}

function dedupeMatches(rows: StoryRetrievalMatch[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) {
      return false;
    }

    seen.add(row.id);
    return true;
  });
}

function buildRetrievalQuery(input: Pick<
  SegmentGenerationInput,
  "story" | "previousSegments" | "previousDecisions" | "selectedAction"
>) {
  const latestSegment = input.previousSegments[input.previousSegments.length - 1];
  const latestDecision = input.previousDecisions[input.previousDecisions.length - 1];
  const chapterPlan =
    input.story.worldState.chapters[input.story.currentSegmentIndex] ??
    input.story.worldState.chapters[input.story.worldState.chapters.length - 1];

  return compactText(
    [
      `Premise: ${input.story.premise}`,
      chapterPlan
        ? `Current chapter plan: ${chapterPlan.title}. ${chapterPlan.summary}`
        : "",
      latestSegment
        ? `Recent narration: ${compactText(latestSegment.audioScript.narration.text, 140)}`
        : "",
      latestDecision ? `Recent decision: ${latestDecision.choiceText}` : "",
      input.selectedAction ? `Player action: ${input.selectedAction.choiceText}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    420,
  );
}

export async function syncStoryWorldMemory(settings: EchoSettings, story: Story) {
  const rows = buildWorldRows(story);
  return upsertMemoryRows(settings, story.id, rows);
}

export async function syncPlayerProfileMemory(
  settings: EchoSettings,
  story: Story,
  profile: PlayerProfile,
) {
  return upsertMemoryRows(settings, story.id, [buildPlayerProfileRow(story, profile)]);
}

export async function syncDecisionMemory(
  settings: EchoSettings,
  story: Story,
  decision: Decision,
) {
  return upsertMemoryRows(settings, story.id, [buildDecisionRow(story, decision)]);
}

export async function syncAudioAssetMemory(
  settings: EchoSettings,
  asset: AudioAsset,
) {
  if (asset.category === "tts" || !asset.embedding?.length) {
    return false;
  }

  return upsertMemoryRows(settings, asset.storyId, [buildAudioAssetRow(asset)]);
}

export async function retrieveStoryContext(
  settings: EchoSettings,
  input: Pick<
    SegmentGenerationInput,
    "story" | "previousSegments" | "previousDecisions" | "selectedAction"
  >,
): Promise<StoryRetrievalContext | null> {
  if (!canUseTurbopuffer(settings)) {
    return null;
  }

  const queryText = buildRetrievalQuery(input);
  const embeddings = await embedTexts(settings, [queryText]);
  const queryEmbedding = embeddings[0] ?? [];
  const typeFilter = ["type", "In", [...RETRIEVAL_TYPES]];
  const decisionFilter = ["type", "Eq", "decision"];
  const queries: Array<Record<string, unknown>> = [];

  if (queryEmbedding.length) {
    queries.push({
      rank_by: ["vector", "ANN", queryEmbedding],
      filters: typeFilter,
      top_k: 6,
      include_attributes: ["type", "entity_id", "label", "text"],
    });
  }

  queries.push({
    rank_by: ["text", "BM25", queryText],
    filters: typeFilter,
    top_k: 5,
    include_attributes: ["type", "entity_id", "label", "text"],
  });
  queries.push({
    rank_by: ["timestamp", "desc"],
    filters: decisionFilter,
    top_k: 4,
    include_attributes: ["type", "entity_id", "label", "text", "timestamp"],
  });

  try {
    const response = await queryNamespace<QueryResponse>(
      settings.turbopuffer,
      getStoryNamespace(input.story.id),
      queries.length === 1 ? queries[0] : { queries },
    );
    const results = response.results ?? [{ rows: response.rows ?? [] }];
    const semanticRows =
      queryEmbedding.length && results[0]
        ? (results[0].rows ?? []).map((row) => toRetrievalMatch(row, "semantic"))
        : [];
    const keywordIndex = queryEmbedding.length ? 1 : 0;
    const decisionIndex = queryEmbedding.length ? 2 : 1;
    const keywordRows =
      results[keywordIndex]?.rows?.map((row) => toRetrievalMatch(row, "keyword")) ?? [];
    const decisionRows =
      results[decisionIndex]?.rows?.map((row) => toRetrievalMatch(row, "decision")) ?? [];

    return {
      queryText,
      semanticMatches: dedupeMatches(semanticRows),
      keywordMatches: dedupeMatches(keywordRows),
      decisionMatches: dedupeMatches(decisionRows),
    };
  } catch (error) {
    warnOnce(
      warnedTurbopufferConfigs,
      getTurbopufferConfigKey(settings),
      "turbopuffer query failed; falling back to local story context only.",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );

    return null;
  }
}

export async function findRemoteAudioAssetMatch(
  settings: EchoSettings,
  storyId: string,
  category: "sfx" | "music",
  queryEmbedding: number[],
  threshold: number,
) {
  if (!canUseTurbopuffer(settings) || !queryEmbedding.length) {
    return null;
  }

  try {
    const baseQuery = {
      rank_by: ["vector", "ANN", queryEmbedding] as const,
      top_k: 5,
      include_attributes: ["type", "asset_id", "label", "text", "category"],
    };

    let response: QueryResponse;

    try {
      response = await queryNamespace<QueryResponse>(
        settings.turbopuffer,
        getStoryNamespace(storyId),
        {
          ...baseQuery,
          filters: [
            "And",
            [
              ["type", "In", [...AUDIO_CACHE_TYPES]],
              ["category", "Eq", category],
            ],
          ],
        },
      );
    } catch (error) {
      if (!isMissingFilterAttributeError(error, "category")) {
        throw error;
      }

      response = await queryNamespace<QueryResponse>(
        settings.turbopuffer,
        getStoryNamespace(storyId),
        {
          ...baseQuery,
          filters: ["type", "In", [...AUDIO_CACHE_TYPES]],
        },
      );
    }

    for (const candidate of response.rows ?? []) {
      if (!candidate.asset_id || typeof candidate.$dist !== "number") {
        continue;
      }

      if (candidate.category && candidate.category !== category) {
        continue;
      }

      const similarity = Math.max(0, 1 - candidate.$dist);
      if (similarity < threshold) {
        continue;
      }

      return {
        assetId: candidate.asset_id,
        score: similarity,
      };
    }
  } catch (error) {
    warnOnce(
      warnedTurbopufferConfigs,
      getTurbopufferConfigKey(settings),
      "turbopuffer audio lookup failed; falling back to local cache matching.",
      {
        error: getErrorMessage(error),
      },
    );

    return null;
  }

  return null;
}
