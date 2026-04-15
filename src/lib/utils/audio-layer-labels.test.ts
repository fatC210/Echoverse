import { describe, expect, it } from "vitest";
import { summarizeAudioLayerLabel } from "./audio-layer-labels";

describe("summarizeAudioLayerLabel", () => {
  it("compresses long sfx prompts into short english keywords", () => {
    expect(
      summarizeAudioLayerLabel({
        description: "Low stone resonance vibration pulsing through wall",
        type: "sfx",
        lang: "en",
        mood: "mystery",
      }),
    ).toBe("Stone resonance · Low hum");
  });

  it("localizes music keywords to the interface language", () => {
    expect(
      summarizeAudioLayerLabel({
        description:
          "Dark ambient drone with deep sub-bass heartbeat pulse; tribal hand-drum rhythm enters slowly mid-section, accelerating slightly toward end",
        type: "music",
        lang: "zh",
        mood: "tension",
      }),
    ).toBe("暗色氛围 · 低频脉冲 · 鼓点节奏");
  });

  it("falls back to localized generic tags when the prompt is too abstract", () => {
    expect(
      summarizeAudioLayerLabel({
        description: "fractal bloom",
        type: "music",
        lang: "zh",
        mood: "mystery",
      }),
    ).toBe("氛围 · 神秘");
  });
});
