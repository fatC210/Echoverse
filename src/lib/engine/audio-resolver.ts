import {
  resolveLlmSettings,
  type EchoSettings,
} from "@/lib/constants/defaults";
import {
  bumpAudioAssetUsage,
  getAudioAsset,
  listAudioAssetsByStoryAndCategory,
  putAudioAsset,
} from "@/lib/db";
import {
  findRemoteAudioAssetMatch,
  syncAudioAssetMemory,
} from "@/lib/engine/turbopuffer-memory";
import {
  generateMusicTrack,
  generateNarrationSpeech,
  generateSoundEffect,
} from "@/lib/services/elevenlabs";
import { createEmbeddings, LlmRequestError } from "@/lib/services/llm";
import type { AudioAsset, Segment, Story } from "@/lib/types/echoverse";
import {
  blobToAudioDuration,
  cosineSimilarity,
  createId,
} from "@/lib/utils/echoverse";
import { planNarrationCues } from "@/lib/utils/narration-voices";

const CACHE_THRESHOLDS = {
  sfx: 0.9,
  music: 0.88,
} as const;
const NONVERBAL_AUDIO_GENERATION_VERSION = "nonverbal_v1";

const disabledEmbeddingConfigs = new Set<string>();
const warnedEmbeddingConfigs = new Set<string>();

function runInBackground(task: Promise<unknown>, label: string) {
  void Promise.resolve(task).catch((error) => {
    console.warn(`${label} failed in background.`, {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

function getEmbeddingConfigKey(settings: EchoSettings) {
  const resolved = resolveLlmSettings(settings.llm);
  return `${resolved.baseUrl}|${resolved.embeddingModel}`;
}

function shouldDisableEmbeddings(error: unknown) {
  if (error instanceof LlmRequestError) {
    return error.status >= 400 && error.status < 500;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /embedding|configuration|missing|not found|unsupported|model/i.test(message);
}

async function embedText(settings: EchoSettings, text: string) {
  if (!text.trim()) {
    return [];
  }

  const configKey = getEmbeddingConfigKey(settings);

  if (disabledEmbeddingConfigs.has(configKey)) {
    return [];
  }

  try {
    const [embedding] = await createEmbeddings(settings.llm, text);
    return embedding ?? [];
  } catch (error) {
    if (shouldDisableEmbeddings(error)) {
      disabledEmbeddingConfigs.add(configKey);
    }

    if (!warnedEmbeddingConfigs.has(configKey)) {
      warnedEmbeddingConfigs.add(configKey);
      console.warn("Embedding lookup unavailable; audio cache similarity matching disabled.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return [];
  }
}

async function findCachedAsset(
  settings: EchoSettings,
  storyId: string,
  category: "sfx" | "music",
  description: string,
) {
  const existingAssets = (await listAudioAssetsByStoryAndCategory(storyId, category)).filter(
    (asset) => asset.generationVersion === NONVERBAL_AUDIO_GENERATION_VERSION,
  );
  const exactMatch = existingAssets.find((asset) => asset.description === description);

  if (exactMatch) {
    await bumpAudioAssetUsage(exactMatch.id);
    return {
      asset: {
        ...exactMatch,
        timesUsed: exactMatch.timesUsed + 1,
      },
      cacheHit: true,
    };
  }

  const queryEmbedding = await embedText(settings, description);
  const threshold = CACHE_THRESHOLDS[category];

  if (!queryEmbedding.length) {
    return {
      asset: null,
      cacheHit: false,
    };
  }

  const remoteMatch = await findRemoteAudioAssetMatch(
    settings,
    storyId,
    category,
    queryEmbedding,
    threshold,
  );

  if (remoteMatch?.assetId) {
    const remoteAsset = await getAudioAsset(remoteMatch.assetId);

    if (
      remoteAsset?.category === category &&
      remoteAsset.generationVersion === NONVERBAL_AUDIO_GENERATION_VERSION
    ) {
      await bumpAudioAssetUsage(remoteAsset.id);
      return {
        asset: {
          ...remoteAsset,
          timesUsed: remoteAsset.timesUsed + 1,
        },
        cacheHit: true,
        embedding: queryEmbedding,
      };
    }
  }

  let bestMatch: AudioAsset | null = null;
  let bestScore = 0;

  for (const asset of existingAssets) {
    if (!asset.embedding?.length || asset.embedding.length !== queryEmbedding.length) {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, asset.embedding);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = asset;
    }
  }

  if (bestMatch && bestScore >= threshold) {
    await bumpAudioAssetUsage(bestMatch.id);
    return {
      asset: {
        ...bestMatch,
        timesUsed: bestMatch.timesUsed + 1,
      },
      cacheHit: true,
    };
  }

  return {
    asset: null,
    cacheHit: false,
    embedding: queryEmbedding,
  };
}

async function createGeneratedAsset(
  settings: EchoSettings,
  storyId: string,
  category: "sfx" | "music" | "tts",
  description: string,
  options: {
    durationSec?: number;
    looping?: boolean;
    mood?: string;
    voiceId?: string;
  },
  existingEmbedding?: number[],
) {
  let generated:
    | Awaited<ReturnType<typeof generateSoundEffect>>
    | Awaited<ReturnType<typeof generateMusicTrack>>
    | Awaited<ReturnType<typeof generateNarrationSpeech>>;

  if (category === "tts") {
    generated = await generateNarrationSpeech(settings.elevenlabs, options.voiceId ?? "", description);
  } else if (category === "sfx") {
    generated = await generateSoundEffect(
      settings.elevenlabs,
      description,
      options.durationSec ?? 8,
      Boolean(options.looping),
    );
  } else {
    generated = await generateMusicTrack(
      settings.elevenlabs,
      description,
      options.durationSec ?? 45,
    );
  }

  const durationSec = await blobToAudioDuration(generated.blob).catch(() => options.durationSec ?? 0);
  const asset = {
    id: createId(category),
    storyId,
    category,
    description,
    generationVersion:
      category === "tts" ? undefined : NONVERBAL_AUDIO_GENERATION_VERSION,
    audioBlob: generated.blob,
    durationSec,
    looping: Boolean(options.looping),
    mood: options.mood ?? "neutral",
    createdAt: new Date().toISOString(),
    timesUsed: 1,
    embedding: existingEmbedding,
    contentType: generated.contentType,
  } satisfies AudioAsset;

  await putAudioAsset(asset);

  if (category !== "tts") {
    runInBackground(syncAudioAssetMemory(settings, asset), "Audio memory sync");
  }

  return asset;
}

export async function resolveSegmentAudio(
  settings: EchoSettings,
  story: Story,
  segment: Segment,
) {
  const nextSegment: Segment = structuredClone(segment);
  const resolvedAudio: NonNullable<Segment["resolvedAudio"]> = {
    sfxAssetIds: [] as string[],
  };
  let cacheHitCount = 0;
  let cacheMissCount = 0;

  const narrationPromise = (async () => {
    try {
      const narrationPlan = planNarrationCues({
        text: segment.audioScript.narration.text,
        narratorVoiceId: settings.voice.voiceId,
        protagonistName: story.worldState.protagonist.name,
        characters: story.worldState.characters,
        scriptedCues: segment.audioScript.narration.voice_cues,
      });
      const narrationCues = [] as NonNullable<Segment["resolvedAudio"]>["narrationCues"];

      for (const cue of narrationPlan) {
        const narrationAsset = await createGeneratedAsset(
          settings,
          story.id,
          "tts",
          cue.text,
          {
            mood: segment.audioScript.mood_color,
            voiceId: cue.voiceId,
          },
        );

        narrationCues.push({
          ...cue,
          assetId: narrationAsset.id,
        });
      }

      return {
        status: "ready" as const,
        assetId:
          narrationCues.length === 1 ? narrationCues[0]?.assetId : undefined,
        cues: narrationCues,
      };
    } catch (error) {
      console.warn("Narration audio generation failed; continuing with text-only narration.", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        status: "failed" as const,
      };
    }
  })();

  const sfxPromises = segment.audioScript.sfx_layers.map(async (layer, index) => {
    try {
      const cache = await findCachedAsset(settings, story.id, "sfx", layer.description);
      const asset =
        cache.asset ??
        (await createGeneratedAsset(
          settings,
          story.id,
          "sfx",
          layer.description,
          {
            durationSec: layer.duration_sec,
            looping: layer.looping,
            mood: segment.audioScript.mood_color,
          },
          cache.embedding,
        ));

      return {
        index,
        status: "ready" as const,
        assetId: asset.id,
        cacheHit: cache.cacheHit ? 1 : 0,
        cacheMiss: cache.cacheHit ? 0 : 1,
      };
    } catch {
      return {
        index,
        status: "failed" as const,
        cacheHit: 0,
        cacheMiss: 0,
      };
    }
  });

  const musicPromise = (async () => {
    if (!segment.audioScript.music?.description) {
      return {
        status: nextSegment.audioStatus.music,
        cacheHit: 0,
        cacheMiss: 0,
      };
    }

    try {
      const cache = await findCachedAsset(
        settings,
        story.id,
        "music",
        segment.audioScript.music.description,
      );
      const asset =
        cache.asset ??
        (await createGeneratedAsset(
          settings,
          story.id,
          "music",
          segment.audioScript.music.description,
          {
            durationSec: segment.audioScript.music.duration_sec,
            looping: false,
            mood: segment.audioScript.mood_color,
          },
          cache.embedding,
        ));

      return {
        status: "ready" as const,
        assetId: asset.id,
        cacheHit: cache.cacheHit ? 1 : 0,
        cacheMiss: cache.cacheHit ? 0 : 1,
      };
    } catch {
      return {
        status: "failed" as const,
        cacheHit: 0,
        cacheMiss: 0,
      };
    }
  })();

  const [narrationResult, sfxResults, musicResult] = await Promise.all([
    narrationPromise,
    Promise.all(sfxPromises),
    musicPromise,
  ]);

  nextSegment.audioStatus.tts = narrationResult.status;
  if (narrationResult.status === "ready") {
    if (narrationResult.assetId) {
      resolvedAudio.narrationAssetId = narrationResult.assetId;
    }

    if (narrationResult.cues?.length) {
      resolvedAudio.narrationCues = narrationResult.cues;
    }
  }

  for (const result of sfxResults) {
    nextSegment.audioStatus.sfx[result.index] = result.status;
    cacheHitCount += result.cacheHit;
    cacheMissCount += result.cacheMiss;

    if (result.status === "ready") {
      resolvedAudio.sfxAssetIds[result.index] = result.assetId;
    }
  }

  nextSegment.audioStatus.music = musicResult.status;
  cacheHitCount += musicResult.cacheHit;
  cacheMissCount += musicResult.cacheMiss;
  if (musicResult.status === "ready") {
    resolvedAudio.musicAssetId = musicResult.assetId;
  }

  nextSegment.resolvedAudio = resolvedAudio;

  return {
    segment: nextSegment,
    cacheHitCount,
    cacheMissCount,
  };
}
