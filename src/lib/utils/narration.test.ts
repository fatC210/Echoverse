import { describe, expect, it } from "vitest";
import { splitNarrationForReveal } from "./narration";

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
});
