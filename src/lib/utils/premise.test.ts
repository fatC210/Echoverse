import { describe, expect, it } from "vitest";
import {
  cleanGeneratedPremise,
  extractGeneratedPremise,
  isMeaningfulPremise,
  isPresentablePremise,
  isRecoverablePremise,
  normalizeGeneratedPremise,
} from "@/lib/utils/premise";

describe("premise utils", () => {
  it("normalizes labels and wrapping quotes from generated premises", () => {
    expect(
      normalizeGeneratedPremise(
        '故事前提：\n“暴雨夜里，一名失忆的船医在港口醒来。”',
      ),
    ).toBe("暴雨夜里，一名失忆的船医在港口醒来。");
  });

  it("rejects placeholder-only premise outputs", () => {
    expect(isMeaningfulPremise("...")).toBe(false);
    expect(isMeaningfulPremise("A direct user-facing story premise goes here.")).toBe(false);
    expect(isMeaningfulPremise("这里是一段可直接展示给用户的故事前提")).toBe(false);
  });

  it("rejects prompt-leak instruction text masquerading as a premise", () => {
    expect(
      isMeaningfulPremise(
        "Analysis Request: Hard requirements: write 2 to 3 sentences and return JSON only.",
      ),
    ).toBe(false);

    expect(
      isMeaningfulPremise(
        "输出格式：只输出 JSON 对象。硬性要求：必须写成 2 到 3 句话，并包含叙事钩子。",
      ),
    ).toBe(false);

    expect(
      isMeaningfulPremise(
        "Tags: Space, Horror. Use these tags to build the story premise.",
      ),
    ).toBe(false);
  });

  it("rejects premises that do not meet the display-ready structure", () => {
    expect(
      isMeaningfulPremise(
        "A botanist receives seed packets labeled with disasters that have not happened yet.",
      ),
    ).toBe(false);

    expect(
      isMeaningfulPremise(
        "A violin teacher moves to a quiet town. She hopes to start over and make new friends.",
      ),
    ).toBe(false);
  });

  it("accepts clean display-ready premises even when the hook is subtle", () => {
    expect(
      isMeaningfulPremise(
        "A conservatory pianist returns to her hometown to catalog the instruments left in a shuttered theater. On her first night back, the stage is already set for a recital nobody has announced.",
      ),
    ).toBe(false);

    expect(
      isPresentablePremise(
        "A conservatory pianist returns to her hometown to catalog the instruments left in a shuttered theater. On her first night back, the stage is already set for a recital nobody has announced.",
      ),
    ).toBe(true);
  });

  it("accepts concrete generated premises with a hook", () => {
    expect(
      isMeaningfulPremise(
        "A voice actor who just moved to a mountain city starts recording bedtime notes to calm herself before sleep. The next morning, each note has turned into a clue about a disappearance that has not happened yet.",
      ),
    ).toBe(true);
  });

  it("accepts concrete Chinese generated premises with a hook", () => {
    expect(
      isMeaningfulPremise(
        "暴雨切断山路后，一名临时代班的深夜电台主持人开始接到只在凌晨三点响起的来电。对方总能提前说中小镇第二天会发生的事，并在最后一次通话里警告她不要回家。",
      ),
    ).toBe(true);
  });

  it("extracts premise text from common valid response shapes", () => {
    expect(
      extractGeneratedPremise({
        story_premise:
          "A botanist receives seed packets labeled with disasters that have not happened yet. When one packet grows overnight in her locked kitchen, she realizes the final envelope is addressed to her.",
      }),
    ).toBe(
      "A botanist receives seed packets labeled with disasters that have not happened yet. When one packet grows overnight in her locked kitchen, she realizes the final envelope is addressed to her.",
    );

    expect(
      extractGeneratedPremise({
        premise: {
          text:
            "A diver maps a flooded chapel that seems to remember every prayer spoken inside it. On the night she hears her brother's missing voice in the nave, the tide stops receding.",
        },
      }),
    ).toBe(
      "A diver maps a flooded chapel that seems to remember every prayer spoken inside it. On the night she hears her brother's missing voice in the nave, the tide stops receding.",
    );

    expect(
      extractGeneratedPremise({
        status: "ok",
        message: {
          content:
            "{\"premise\":\"A night archivist discovers the missing pages in her library are being checked out by events that have not happened yet. When tomorrow's fire signs one of the slips with her name, she has until dawn to find who is borrowing the future.\"}",
        },
      }),
    ).toBe(
      "A night archivist discovers the missing pages in her library are being checked out by events that have not happened yet. When tomorrow's fire signs one of the slips with her name, she has until dawn to find who is borrowing the future.",
    );
  });

  it("removes leaked instruction sentences and keeps the actual premise text", () => {
    expect(
      cleanGeneratedPremise(
        "Output format: return JSON only. A salvage diver takes one last job inside a dead sea gate before the oxygen market closes for the night. In the flooded lock, she hears a distress call recorded in her own voice tomorrow.",
      ),
    ).toBe(
      "A salvage diver takes one last job inside a dead sea gate before the oxygen market closes for the night. In the flooded lock, she hears a distress call recorded in her own voice tomorrow.",
    );
  });

  it("strips wrapping markdown fences before evaluating recoverable premise text", () => {
    expect(
      cleanGeneratedPremise(
        "```text\nPremise: A sleep-deprived archivist opens a returned library book and finds tomorrow's checkout slip already stamped with her name.\n```",
      ),
    ).toBe(
      "A sleep-deprived archivist opens a returned library book and finds tomorrow's checkout slip already stamped with her name.",
    );

    expect(
      isRecoverablePremise(
        "```text\nPremise: A sleep-deprived archivist opens a returned library book and finds tomorrow's checkout slip already stamped with her name.\n```",
      ),
    ).toBe(true);
  });

  it("returns empty text when the entire response is prompt leakage", () => {
    expect(
      cleanGeneratedPremise(
        "Hard requirements: write 2 to 3 sentences. Return JSON only. Do not output anything except the premise field.",
      ),
    ).toBe("");

    expect(
      cleanGeneratedPremise(
        "标签：太空，悬疑。输出格式：只输出 JSON 对象。硬性要求：必须写成 2 到 3 句话。",
      ),
    ).toBe("");
  });
});
