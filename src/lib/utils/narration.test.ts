import { describe, expect, it } from "vitest";
import {
  buildNarrationRevealThresholds,
  estimateNarrationChunkWeight,
  getNarrationAssetIds,
  getNarrationDurationSec,
  getVisibleNarrationChunkCount,
  splitNarrationForReveal,
} from "./narration";

describe("splitNarrationForReveal", () => {
  it("keeps whitespace with english word chunks", () => {
    expect(splitNarrationForReveal("The lamp flickers in the hall.")).toEqual([
      "The ",
      "lamp ",
      "flickers ",
      "in ",
      "the ",
      "hall.",
    ]);
  });

  it("splits chinese narration without requiring spaces", () => {
    const result = splitNarrationForReveal("雨声从走廊尽头慢慢逼近。");

    expect(result.length).toBeGreaterThan(1);
    expect(result.join("")).toBe("雨声从走廊尽头慢慢逼近。");
  });

  it("returns no chunks for empty narration", () => {
    expect(splitNarrationForReveal("   ")).toEqual([]);
  });

  it("holds punctuation-bearing chunks slightly longer during reveal", () => {
    const chunks = ["Wait, ", "don't ", "go."];
    const thresholds = buildNarrationRevealThresholds(chunks);

    expect(estimateNarrationChunkWeight(chunks[0])).toBeGreaterThan(
      estimateNarrationChunkWeight("Wait "),
    );
    expect(getVisibleNarrationChunkCount(thresholds, 0.2)).toBe(1);
    expect(getVisibleNarrationChunkCount(thresholds, 0.55)).toBe(2);
    expect(getVisibleNarrationChunkCount(thresholds, 1)).toBe(3);
  });

  it("prefers narration cue assets when a segment uses multiple dialogue voices", () => {
    const segment = {
      resolvedAudio: {
        narrationAssetId: "legacy_tts",
        narrationCues: [
          {
            assetId: "tts_1",
            text: "ARIA",
            kind: "dialogue" as const,
            voiceId: "voice_1",
          },
          {
            assetId: "tts_2",
            text: "Mira",
            kind: "dialogue" as const,
            voiceId: "voice_2",
          },
        ],
        sfxAssetIds: [],
      },
    };

    expect(getNarrationAssetIds(segment as never)).toEqual(["tts_1", "tts_2"]);
    expect(
      getNarrationDurationSec(segment as never, {
        tts_1: { durationSec: 1.5 },
        tts_2: { durationSec: 2.25 },
      } as never),
    ).toBe(3.75);
  });
});
