import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/constants/defaults";
import type { Segment, Story } from "@/lib/types/echoverse";
import { createEmbeddings, LlmRequestError } from "@/lib/services/llm";
import {
  generateMusicTrack,
  generateNarrationSpeech,
  generateSoundEffect,
} from "@/lib/services/elevenlabs";
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
import { resolveSegmentAudio } from "./audio-resolver";

vi.mock("@/lib/db", () => ({
  bumpAudioAssetUsage: vi.fn(),
  getAudioAsset: vi.fn(),
  listAudioAssetsByStoryAndCategory: vi.fn(),
  putAudioAsset: vi.fn(),
}));

vi.mock("@/lib/engine/turbopuffer-memory", () => ({
  findRemoteAudioAssetMatch: vi.fn(),
  syncAudioAssetMemory: vi.fn(),
}));

vi.mock("@/lib/services/elevenlabs", () => ({
  generateMusicTrack: vi.fn(),
  generateNarrationSpeech: vi.fn(),
  generateSoundEffect: vi.fn(),
}));

vi.mock("@/lib/services/llm", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/llm")>(
    "@/lib/services/llm",
  );

  return {
    ...actual,
    createEmbeddings: vi.fn(),
  };
});

vi.mock("@/lib/utils/echoverse", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils/echoverse")>(
    "@/lib/utils/echoverse",
  );
  let counter = 0;

  return {
    ...actual,
    blobToAudioDuration: vi.fn().mockResolvedValue(4),
    createId: vi.fn((prefix: string) => {
      counter += 1;
      return `${prefix}_${counter}`;
    }),
  };
});

const audioBlob = new Blob(["audio"], { type: "audio/mpeg" });

const baseStory: Story = {
  id: "story_1",
  title: "Echo Station",
  genre: "Mystery",
  tags: {
    preset: [],
    custom: [],
  },
  premise: "A signal begins answering questions that nobody has asked yet.",
  worldState: {
    title: "Echo Station",
    genre: "Mystery",
    tone: "tense",
    setting: {
      location: "A failing relay station",
      era: "near future",
      atmosphere: "thin static and cold fluorescent light",
    },
    protagonist: {
      name: "Mira",
      role: "relay engineer",
      personality: "careful but curious",
      motivation: "keep the station alive",
      wound: "she trusts signals more than people",
    },
    characters: [],
    locations: [],
    items: [],
    sonic_dna: {
      palette: ["static", "metal groan"],
      music_style: "minimal ambient",
      avoid: [],
      signature_sound: "detuned chime",
    },
    chapters: [
      {
        id: "chapter_1",
        title: "The First Reply",
        summary: "A transmission answers before Mira finishes speaking.",
        target_mood: "mystery",
        target_choices: 3,
      },
    ],
    story_rules: {
      story_language: "en",
      total_target_choices: 3,
    },
  },
  status: "playing",
  currentChapter: "chapter_1",
  currentSegmentIndex: 0,
  continuedAfterEnding: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  totalDurationSec: 0,
  totalDecisions: 0,
  cacheHitCount: 0,
  cacheMissCount: 0,
};

const baseSegment: Segment = {
  id: "segment_1",
  storyId: "story_1",
  chapterId: "chapter_1",
  audioScript: {
    segment_id: "segment_1",
    chapter: "chapter_1",
    chapter_title: "The First Reply",
    mood_color: "mystery",
    emotion_arc: "Tension rises",
    is_ending: false,
    ending_name: null,
    narration: {
      text: "A voice slips through the static before Mira finishes her sentence.",
      voice_style: "close",
    },
    sfx_layers: [
      {
        id: "sfx_1",
        start_sec: 0,
        description: "soft static crackle",
        duration_sec: 4,
        looping: false,
        volume: 0.3,
      },
    ],
    music: {
      description: "minimal ambient synth pulse",
      duration_sec: 20,
      volume: 0.4,
      transition: "crossfade_from_previous_4s",
    },
    state_updates: [],
    choices: [
      {
        id: "choice_1",
        text: "Move forward carefully",
        hint: "Take a measured step",
        risk: "low",
        unlocks: "more clues",
      },
    ],
  },
  audioStatus: {
    tts: "pending",
    sfx: ["pending"],
    music: "pending",
  },
  resolvedAudio: {
    sfxAssetIds: [],
  },
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("resolveSegmentAudio", () => {
  beforeEach(() => {
    vi.mocked(bumpAudioAssetUsage).mockResolvedValue(undefined);
    vi.mocked(getAudioAsset).mockResolvedValue(undefined);
    vi.mocked(listAudioAssetsByStoryAndCategory).mockResolvedValue([]);
    vi.mocked(putAudioAsset).mockResolvedValue(undefined);
    vi.mocked(findRemoteAudioAssetMatch).mockResolvedValue(null);
    vi.mocked(syncAudioAssetMemory).mockResolvedValue(false);
    vi.mocked(generateNarrationSpeech).mockResolvedValue({
      blob: audioBlob,
      contentType: "audio/mpeg",
    });
    vi.mocked(generateSoundEffect).mockResolvedValue({
      blob: audioBlob,
      contentType: "audio/mpeg",
    });
    vi.mocked(generateMusicTrack).mockResolvedValue({
      blob: audioBlob,
      contentType: "audio/mpeg",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to direct audio generation when embeddings are unavailable", async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      llm: {
        ...DEFAULT_SETTINGS.llm,
        apiKey: "sk-test",
        baseUrl: "https://example.com/v1",
        embeddingModel: "broken-embeddings",
      },
      voice: {
        ...DEFAULT_SETTINGS.voice,
        voiceId: "voice_1",
      },
    };

    vi.mocked(createEmbeddings).mockRejectedValue(
      new LlmRequestError("embedding model not found", 400),
    );

    const result = await resolveSegmentAudio(settings, baseStory, baseSegment);

    expect(result.segment.audioStatus.tts).toBe("ready");
    expect(result.segment.audioStatus.sfx[0]).toBe("ready");
    expect(result.segment.audioStatus.music).toBe("ready");
    expect(result.segment.resolvedAudio?.narrationAssetId).toBeTruthy();
    expect(result.segment.resolvedAudio?.sfxAssetIds).toHaveLength(1);
    expect(result.segment.resolvedAudio?.musicAssetId).toBeTruthy();
    expect(createEmbeddings).toHaveBeenCalledTimes(2);
  });

  it("reuses a local audio blob when turbopuffer finds a semantic cache hit", async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      llm: {
        ...DEFAULT_SETTINGS.llm,
        apiKey: "sk-test",
        baseUrl: "https://example.com/v1",
        embeddingModel: "working-embeddings",
      },
      turbopuffer: {
        ...DEFAULT_SETTINGS.turbopuffer,
        apiKey: "tpuf-test",
      },
      voice: {
        ...DEFAULT_SETTINGS.voice,
        voiceId: "voice_1",
      },
    };
    const cachedAsset = {
      id: "sfx_cached",
      storyId: "story_1",
      category: "sfx" as const,
      description: "soft static crackle",
      generationVersion: "nonverbal_v1",
      audioBlob,
      durationSec: 4,
      looping: false,
      mood: "mystery",
      createdAt: "2026-01-01T00:00:00.000Z",
      timesUsed: 2,
      embedding: [0.1, 0.2, 0.3],
      contentType: "audio/mpeg",
    };

    vi.mocked(createEmbeddings).mockResolvedValue([[0.1, 0.2, 0.3], [0.3, 0.2, 0.1]]);
    vi.mocked(findRemoteAudioAssetMatch).mockResolvedValue({
      assetId: "sfx_cached",
      score: 0.96,
    });
    vi.mocked(getAudioAsset).mockResolvedValue(cachedAsset);

    const result = await resolveSegmentAudio(settings, baseStory, baseSegment);

    expect(findRemoteAudioAssetMatch).toHaveBeenCalled();
    expect(generateSoundEffect).not.toHaveBeenCalledWith(
      expect.anything(),
      "soft static crackle",
      expect.anything(),
      expect.anything(),
    );
    expect(result.cacheHitCount).toBeGreaterThan(0);
    expect(result.segment.resolvedAudio?.sfxAssetIds).toContain("sfx_cached");
  });

  it("ignores legacy cached ambience assets that were created before the nonverbal prompt fix", async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      llm: {
        ...DEFAULT_SETTINGS.llm,
        apiKey: "sk-test",
        baseUrl: "https://example.com/v1",
        embeddingModel: "working-embeddings",
      },
      voice: {
        ...DEFAULT_SETTINGS.voice,
        voiceId: "voice_1",
      },
    };
    const legacyAsset = {
      id: "sfx_legacy",
      storyId: "story_1",
      category: "sfx" as const,
      description: "soft static crackle",
      audioBlob,
      durationSec: 4,
      looping: false,
      mood: "mystery",
      createdAt: "2026-01-01T00:00:00.000Z",
      timesUsed: 2,
      embedding: [0.1, 0.2, 0.3],
      contentType: "audio/mpeg",
    };

    vi.mocked(createEmbeddings).mockResolvedValue([[0.1, 0.2, 0.3]]);
    vi.mocked(listAudioAssetsByStoryAndCategory).mockResolvedValue([legacyAsset]);

    const result = await resolveSegmentAudio(settings, baseStory, baseSegment);

    expect(generateSoundEffect).toHaveBeenCalled();
    expect(result.segment.resolvedAudio?.sfxAssetIds).not.toContain("sfx_legacy");
  });

  it("keeps the segment usable when narration audio generation fails", async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      llm: {
        ...DEFAULT_SETTINGS.llm,
        apiKey: "sk-test",
        baseUrl: "https://example.com/v1",
        embeddingModel: "working-embeddings",
      },
      voice: {
        ...DEFAULT_SETTINGS.voice,
        voiceId: "voice_2",
      },
    };

    vi.mocked(createEmbeddings).mockResolvedValue([[0.1, 0.2, 0.3]]);
    vi.mocked(generateNarrationSpeech).mockRejectedValue(new Error("tts unavailable"));

    const result = await resolveSegmentAudio(settings, baseStory, baseSegment);

    expect(result.segment.audioStatus.tts).toBe("failed");
    expect(result.segment.audioStatus.sfx[0]).toBe("ready");
    expect(result.segment.audioStatus.music).toBe("ready");
    expect(result.segment.resolvedAudio?.narrationAssetId).toBeUndefined();
  });

  it("keeps sfx asset ids aligned with their source layer indexes", async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      llm: {
        ...DEFAULT_SETTINGS.llm,
        apiKey: "sk-test",
        baseUrl: "https://example.com/v1",
        embeddingModel: "working-embeddings",
      },
      voice: {
        ...DEFAULT_SETTINGS.voice,
        voiceId: "voice_1",
      },
    };
    const segmentWithTwoLayers: Segment = {
      ...baseSegment,
      audioScript: {
        ...baseSegment.audioScript,
        sfx_layers: [
          {
            id: "sfx_1",
            start_sec: 0,
            description: "broken layer",
            duration_sec: 3,
            looping: false,
            volume: 0.3,
          },
          {
            id: "sfx_2",
            start_sec: 1,
            description: "surviving layer",
            duration_sec: 4,
            looping: false,
            volume: 0.5,
          },
        ],
      },
      audioStatus: {
        ...baseSegment.audioStatus,
        sfx: ["pending", "pending"],
      },
    };

    vi.mocked(createEmbeddings).mockResolvedValue([[0.1, 0.2, 0.3], [0.3, 0.2, 0.1]]);
    vi.mocked(generateSoundEffect).mockImplementation(async (_config, description) => {
      if (description === "broken layer") {
        throw new Error("generation failed");
      }

      return {
        blob: audioBlob,
        contentType: "audio/mpeg",
      };
    });

    const result = await resolveSegmentAudio(settings, baseStory, segmentWithTwoLayers);

    expect(result.segment.audioStatus.sfx).toEqual(["failed", "ready"]);
    expect(result.segment.resolvedAudio?.sfxAssetIds[0]).toBeUndefined();
    expect(result.segment.resolvedAudio?.sfxAssetIds[1]).toBeTruthy();
  });

  it("splits narration into multiple tts cues and switches character dialogue to a non-narrator voice", async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      llm: {
        ...DEFAULT_SETTINGS.llm,
        apiKey: "sk-test",
        baseUrl: "https://example.com/v1",
        embeddingModel: "working-embeddings",
      },
      voice: {
        ...DEFAULT_SETTINGS.voice,
        voiceId: "nPczCjzI2devNBz1zQrb",
      },
    };
    const storyWithCharacter: Story = {
      ...baseStory,
      worldState: {
        ...baseStory.worldState,
        protagonist: {
          ...baseStory.worldState.protagonist,
          name: "Lin Wei",
        },
        characters: [
          {
            id: "aria",
            name: "ARIA",
            role: "station AI",
            personality: "precise and restrained",
            relationship_to_protagonist: "system partner",
            voice_description: "synthetic, calm, precise",
          },
        ],
      },
    };
    const segmentWithDialogue: Segment = {
      ...baseSegment,
      audioScript: {
        ...baseSegment.audioScript,
        narration: {
          ...baseSegment.audioScript.narration,
          text: "The relay stutters once. Static presses against the glass.",
          voice_cues: [
            {
              kind: "narration",
              text: "The relay stutters once.",
              speaker: null,
            },
            {
              kind: "dialogue",
              text: "Stop accessing the restricted archive.",
              speaker: "ARIA",
            },
            {
              kind: "narration",
              text: "Static presses against the glass.",
              speaker: null,
            },
          ],
        },
      },
    };

    vi.mocked(createEmbeddings).mockResolvedValue([[0.1, 0.2, 0.3]]);

    const result = await resolveSegmentAudio(settings, storyWithCharacter, segmentWithDialogue);

    expect(result.segment.audioStatus.tts).toBe("ready");
    expect(result.segment.resolvedAudio?.narrationCues).toHaveLength(3);
    expect(generateNarrationSpeech).toHaveBeenCalledTimes(3);
    const voiceIds = vi.mocked(generateNarrationSpeech).mock.calls.map((call) => call[1]);

    expect(voiceIds[0]).toBe("nPczCjzI2devNBz1zQrb");
    expect(voiceIds[1]).toBeTruthy();
    expect(voiceIds[1]).not.toBe("nPczCjzI2devNBz1zQrb");
    expect(voiceIds[2]).toBe("nPczCjzI2devNBz1zQrb");
    expect(result.segment.resolvedAudio?.narrationAssetId).toBeUndefined();
  });
});
