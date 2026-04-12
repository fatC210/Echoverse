import {
  resolveLlmSettings,
  type EchoSettings,
} from "@/lib/constants/defaults";
import {
  bumpAudioAssetUsage,
  listAudioAssetsByStoryAndCategory,
  putAudioAsset,
} from "@/lib/db";
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

const CACHE_THRESHOLDS = {
  sfx: 0.9,
  music: 0.88,
} as const;

const disabledEmbeddingConfigs = new Set<string>();
const warnedEmbeddingConfigs = new Set<string>();

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
  const existingAssets = await listAudioAssetsByStoryAndCategory(storyId, category);
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

  try {
    const narrationAsset = await createGeneratedAsset(
      settings,
      story.id,
      "tts",
      segment.audioScript.narration.text,
      {
        mood: segment.audioScript.mood_color,
        voiceId: settings.voice.voiceId,
      },
    );
    nextSegment.audioStatus.tts = "ready";
    resolvedAudio.narrationAssetId = narrationAsset.id;
  } catch (error) {
    nextSegment.audioStatus.tts = "failed";
    console.warn("Narration audio generation failed; continuing with text-only narration.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  for (let index = 0; index < segment.audioScript.sfx_layers.length; index += 1) {
    const layer = segment.audioScript.sfx_layers[index];

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

      cacheHitCount += cache.cacheHit ? 1 : 0;
      cacheMissCount += cache.cacheHit ? 0 : 1;
      nextSegment.audioStatus.sfx[index] = "ready";
      resolvedAudio.sfxAssetIds.push(asset.id);
    } catch {
      nextSegment.audioStatus.sfx[index] = "failed";
    }
  }

  if (segment.audioScript.music?.description) {
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

      cacheHitCount += cache.cacheHit ? 1 : 0;
      cacheMissCount += cache.cacheHit ? 0 : 1;
      nextSegment.audioStatus.music = "ready";
      resolvedAudio.musicAssetId = asset.id;
    } catch {
      nextSegment.audioStatus.music = "failed";
    }
  }

  nextSegment.resolvedAudio = resolvedAudio;

  return {
    segment: nextSegment,
    cacheHitCount,
    cacheMissCount,
  };
}
