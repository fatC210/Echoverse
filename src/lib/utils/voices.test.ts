import { describe, expect, it } from "vitest";
import {
  filterVoicesByGender,
  getLocalizedVoiceName,
  getVoiceOptionDisplayName,
} from "./voices";

describe("voice display helpers", () => {
  it("keeps built-in voice names in English even in the Chinese UI", () => {
    expect(
      getLocalizedVoiceName("EXAVITQu4vr4xnSDxMaL", "莎拉", "zh"),
    ).toBe("Sarah");
  });

  it("strips ElevenLabs voice descriptors from display names", () => {
    expect(
      getVoiceOptionDisplayName(
        {
          voice_id: "bella",
          name: "Bella - Professional, Bright, Warm",
        },
        "zh",
      ),
    ).toBe("Bella");

    expect(
      getVoiceOptionDisplayName(
        {
          voice_id: "laura",
          name: "Laura_Enthusiast, Quirky Attitude",
        },
        "en",
      ),
    ).toBe("Laura");
  });

  it("filters voices by the gender label", () => {
    const voices = [
      {
        voice_id: "voice-female",
        name: "Bella",
        labels: { gender: "female" },
      },
      {
        voice_id: "voice-male",
        name: "Callum",
        labels: { gender: "male" },
      },
      {
        voice_id: "voice-unknown",
        name: "River",
      },
    ];

    expect(filterVoicesByGender(voices, "female")).toEqual([voices[0]]);
    expect(filterVoicesByGender(voices, "male")).toEqual([voices[1]]);
    expect(filterVoicesByGender(voices, "all")).toEqual(voices);
  });
});
