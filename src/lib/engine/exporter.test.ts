import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioAsset, Segment, Story } from "@/lib/types/echoverse";
import { downloadBlob } from "@/lib/utils/echoverse";
import { exportStoryAudioMp3, exportStoryMarkdown, exportWorldJson } from "./exporter";

vi.mock("@/lib/utils/echoverse", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/echoverse")>();

  return {
    ...actual,
    downloadBlob: vi.fn(),
  };
});

const renderedLeftChannel = new Float32Array([0, 0.5, -0.5]);
const renderedRightChannel = new Float32Array([0.25, -0.25, 0]);

class FakeAudioContext {
  async decodeAudioData(_arrayBuffer: ArrayBuffer) {
    return { duration: 1 } as AudioBuffer;
  }

  async close() {
    return undefined;
  }
}

class FakeGainNode {
  gain = { value: 1 };

  connect() {
    return undefined;
  }
}

class FakeBufferSourceNode {
  buffer?: AudioBuffer;
  loop = false;

  connect() {
    return undefined;
  }

  start() {
    return undefined;
  }

  stop() {
    return undefined;
  }
}

class FakeOfflineAudioContext {
  destination = {};

  constructor(
    _channels: number,
    _length: number,
    _sampleRate: number,
  ) {}

  createGain() {
    return new FakeGainNode() as unknown as GainNode;
  }

  createBufferSource() {
    return new FakeBufferSourceNode() as unknown as AudioBufferSourceNode;
  }

  async startRendering() {
    return {
      numberOfChannels: 2,
      sampleRate: 44_100,
      getChannelData: (channel: number) =>
        channel === 0 ? renderedLeftChannel : renderedRightChannel,
    } as AudioBuffer;
  }
}

describe("exportStoryAudioMp3", () => {
  beforeEach(() => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `
          function lamejs() {}
          lamejs.Mp3Encoder = function Mp3Encoder(channels, sampleRate, kbps) {
            globalThis.__mp3EncoderArgs = { channels, sampleRate, kbps };
            this.encodeBuffer = function encodeBuffer(left, right) {
              globalThis.__mp3EncodeCalls = globalThis.__mp3EncodeCalls || [];
              globalThis.__mp3EncodeCalls.push({
                left: Array.from(left),
                right: right ? Array.from(right) : null,
              });
              return new Int8Array([1, 2, 3]);
            };
            this.flush = function flush() {
              return new Int8Array([4, 5]);
            };
          };
        `,
      }),
    );
    delete (globalThis as typeof globalThis & { __echoverseLameJs?: unknown }).__echoverseLameJs;
    delete (globalThis as typeof globalThis & { __echoverseLameJsPromise?: unknown }).__echoverseLameJsPromise;
    delete (globalThis as typeof globalThis & { __mp3EncoderArgs?: unknown }).__mp3EncoderArgs;
    delete (globalThis as typeof globalThis & { __mp3EncodeCalls?: unknown }).__mp3EncodeCalls;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses readable filenames for markdown and json exports", () => {
    const story = {
      id: "story_1",
      title: "不夜城还在",
      worldState: {
        title: "不夜城还在",
      },
    } as Story;

    exportStoryMarkdown(story, []);
    exportWorldJson(story);

    expect(downloadBlob).toHaveBeenNthCalledWith(1, expect.any(Blob), "不夜城还在.md");
    expect(downloadBlob).toHaveBeenNthCalledWith(2, expect.any(Blob), "不夜城还在.json");
  });

  it("renders story audio and downloads an mp3 blob", async () => {
    await exportStoryAudioMp3(
      {
        id: "story_1",
        title: "不夜城还在",
      } as Story,
      [
        {
          audioScript: {
            chapter_title: "Chapter 1",
            mood_color: "mystery",
            narration: {
              text: "A quiet room waits for your next move.",
            },
            sfx_layers: [],
          },
          resolvedAudio: {
            narrationAssetId: "tts_1",
            sfxAssetIds: [],
          },
        } as Segment,
      ],
      {
        tts_1: {
          audioBlob: {
            arrayBuffer: async () => new ArrayBuffer(8),
          } as Blob,
        } as AudioAsset,
      },
    );

    expect(fetch).toHaveBeenCalledWith("/vendor/lame.all.js");
    expect((globalThis as typeof globalThis & { __mp3EncoderArgs?: unknown }).__mp3EncoderArgs).toEqual({
      channels: 2,
      sampleRate: 44_100,
      kbps: 128,
    });
    expect((globalThis as typeof globalThis & { __mp3EncodeCalls?: unknown }).__mp3EncodeCalls).toEqual([
      {
        left: [0, 16383, -16384],
        right: [8191, -8192, 0],
      },
    ]);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(vi.mocked(downloadBlob).mock.calls[0]?.[1]).toBe("不夜城还在.mp3");
    expect(vi.mocked(downloadBlob).mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(vi.mocked(downloadBlob).mock.calls[0]?.[0].type).toBe("audio/mpeg");
  });
});
