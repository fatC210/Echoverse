import { describe, expect, it } from "vitest";
import { isMeaningfulPremise, normalizeGeneratedPremise } from "@/lib/utils/premise";

describe("premise utils", () => {
  it("normalizes labels and wrapping quotes from generated premises", () => {
    expect(normalizeGeneratedPremise("故事前提：\n“暴雨夜里，一名失忆的船医在港口醒来。”"))
      .toBe("暴雨夜里，一名失忆的船医在港口醒来。");
  });

  it("rejects placeholder-only premise outputs", () => {
    expect(isMeaningfulPremise("...")).toBe(false);
    expect(isMeaningfulPremise("A direct user-facing story premise goes here.")).toBe(false);
    expect(isMeaningfulPremise("这里是一段可直接展示给用户的故事前提")).toBe(false);
  });

  it("accepts concrete generated premises", () => {
    expect(
      isMeaningfulPremise("一名刚搬到山城的配音演员发现，自己每晚录下的睡前备忘都会在第二天变成真实线索。"),
    ).toBe(true);
  });
});
