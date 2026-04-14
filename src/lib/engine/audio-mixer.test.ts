import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioAsset, Segment } from "@/lib/types/echoverse";

const createdContexts: FakeAudioContext[] = [];

class FakeAudioParam {
  value: number;

  constructor(initialValue = 1) {
    this.value = initialValue;
  }

  cancelScheduledValues = vi.fn();

  setValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });

  linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}

class FakeGainNode {
  gain = new FakeAudioParam();

  connect = vi.fn();
}

class FakeBufferSource {
  buffer?: { duration: number };
  loop = false;
  onended: (() => void) | null = null;

  connect = vi.fn();

  start = vi.fn();

  stop = vi.fn();
}

class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 12;
  destination = {};
  gains: FakeGainNode[] = [];
  sources: FakeBufferSource[] = [];

  constructor() {
    createdContexts.push(this);
  }

  createGain() {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createBufferSource() {
    const source = new FakeBufferSource();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  decodeAudioData = vi.fn(async () => ({ duration: 2 } as AudioBuffer));

  resume = vi.fn(async () => {
    this.state = "running";
  });

  suspend = vi.fn(async () => {
    this.state = "suspended";
  });
}

function createMusicSegment(): Segment {
  return {
    id: "segment_1",
    storyId: "story_1",
    chapterId: "chapter_1",
    audioScript: {
      segment_id: "segment_1",
      chapter: "chapter_1",
      chapter_title: "The First Reply",
      mood_color: "tension",
      emotion_arc: "pressure builds",
      is_ending: false,
      ending_name: null,
      narration: {
        text: "The relay room listens back.",
        voice_style: "close",
      },
      sfx_layers: [],
      music: {
        description: "instrumental pulse",
        duration_sec: 45,
        volume: 0.8,
        transition: "crossfade_from_previous_4s",
      },
      state_updates: [],
      choices: [],
    },
    audioStatus: {
      tts: "failed",
      sfx: [],
      music: "ready",
    },
    resolvedAudio: {
      sfxAssetIds: [],
      musicAssetId: "music_1",
    },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function createMusicAsset(): AudioAsset {
  return {
    id: "music_1",
    storyId: "story_1",
    category: "music",
    description: "instrumental pulse",
    audioBlob: {
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Blob,
    durationSec: 45,
    looping: false,
    mood: "tension",
    createdAt: "2026-01-01T00:00:00.000Z",
    timesUsed: 1,
  };
}

describe("AudioMixer", () => {
  beforeEach(() => {
    createdContexts.length = 0;
    vi.resetModules();
    (globalThis as typeof globalThis & { AudioContext?: typeof AudioContext }).AudioContext =
      FakeAudioContext as unknown as typeof AudioContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves authored music intensity when starting playback and when the user adjusts the music slider", async () => {
    const { getAudioMixer } = await import("./audio-mixer");
    const mixer = getAudioMixer();
    const segment = createMusicSegment();
    const assetMap = {
      music_1: createMusicAsset(),
    };

    await mixer.playSegment(segment, assetMap);

    const context = createdContexts[0];
    expect(context).toBeDefined();
    const musicGain = context.gains[3];

    expect(musicGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.8, 14.05);

    mixer.setVolumes({
      master: 1,
      narration: 1,
      sfx: 0.7,
      music: 0.3,
    });

    expect(musicGain.gain.value).toBeCloseTo(0.6);
  });

  it("exposes the audio context clock for sync consumers", async () => {
    const { getAudioMixer } = await import("./audio-mixer");
    const mixer = getAudioMixer();

    await mixer.resume();

    expect(mixer.getCurrentTime()).toBe(12);
  });
});
