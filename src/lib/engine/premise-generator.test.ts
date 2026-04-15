import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/constants/defaults";
import { generateLlmText } from "@/lib/services/llm";
import { buildLocalPremiseFallback, generateStoryPremise } from "./premise-generator";

vi.mock("@/lib/services/llm", () => ({
  generateLlmText: vi.fn(),
}));

const baseInput = {
  language: "en" as const,
  selectedTags: [] as Array<{ id: string; label: string; isCustom: boolean }>,
};

describe("generateStoryPremise", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a presentable premise on the first plain-text attempt", async () => {
    vi.mocked(generateLlmText).mockResolvedValue(
      "A conservatory pianist returns to her hometown to catalog the instruments left in a shuttered theater. On her first night back, the stage is already set for a recital nobody has announced.",
    );

    const result = await generateStoryPremise(DEFAULT_SETTINGS.llm, baseInput);

    expect(result).toEqual({
      premise:
        "A conservatory pianist returns to her hometown to catalog the instruments left in a shuttered theater. On her first night back, the stage is already set for a recital nobody has announced.",
    });
    expect(generateLlmText).toHaveBeenCalledTimes(1);
  });

  it("retries once when the first result does not clearly reflect the selected tags", async () => {
    const taggedInput = {
      language: "en" as const,
      selectedTags: [
        { id: "space", label: "Space", isCustom: false },
        { id: "horror", label: "Horror", isCustom: false },
        { id: "detective", label: "Detective", isCustom: false },
      ],
    };

    vi.mocked(generateLlmText)
      .mockResolvedValueOnce(
        "A courier discovers a suitcase that arrives one day before every disaster. When the case appears with her own address on it, she has one night to learn who is sending warnings from tomorrow.",
      )
      .mockResolvedValueOnce(
        "A terrified detective arrives aboard a drifting space station to get through what should have been an ordinary assignment. When the first corpse opens its eyes after lights-out, he realizes the thing waiting in the dark already knows his name.",
      );

    const result = await generateStoryPremise(DEFAULT_SETTINGS.llm, taggedInput);

    expect(result).toEqual({
      premise:
        "A terrified detective arrives aboard a drifting space station to get through what should have been an ordinary assignment. When the first corpse opens its eyes after lights-out, he realizes the thing waiting in the dark already knows his name.",
    });
    expect(generateLlmText).toHaveBeenCalledTimes(2);
  });

  it("retries when the first result is too similar to a premise that should be avoided", async () => {
    const repeatedPremise =
      "A station archivist finds a maintenance log that records tomorrow's breach before tonight's alarms begin. When the final line names her as the only witness left alive, she has one shift to learn who is writing the station's future.";

    vi.mocked(generateLlmText)
      .mockResolvedValueOnce(repeatedPremise)
      .mockResolvedValueOnce(
        "A station archivist opens a cargo manifest that includes one sealed crate scheduled to arrive six hours ago. When the crate's destination resolves to her quarters and the crew insists it has always been there, she starts tracing who changed the station's memory first.",
      );

    const result = await generateStoryPremise(DEFAULT_SETTINGS.llm, {
      ...baseInput,
      selectedTags: [{ id: "space", label: "Space", isCustom: false }],
      avoidPremises: [repeatedPremise],
    });

    expect(result).toEqual({
      premise:
        "A station archivist opens a cargo manifest that includes one sealed crate scheduled to arrive six hours ago. When the crate's destination resolves to her quarters and the crew insists it has always been there, she starts tracing who changed the station's memory first.",
    });
    expect(generateLlmText).toHaveBeenCalledTimes(2);
  });

  it("cleans labels and markdown fences from text output before accepting it", async () => {
    vi.mocked(generateLlmText).mockResolvedValue(
      "```text\nPremise: A lighthouse mechanic takes the winter shift on an island whose beacon was retired decades ago.\n```",
    );

    const result = await generateStoryPremise(DEFAULT_SETTINGS.llm, baseInput);

    expect(result).toEqual({
      premise:
        "A lighthouse mechanic takes the winter shift on an island whose beacon was retired decades ago.",
    });
  });

  it("returns an emergency fallback premise when both text attempts are unusable", async () => {
    vi.mocked(generateLlmText)
      .mockResolvedValueOnce("Output format: write exactly 2 to 3 sentences.")
      .mockResolvedValueOnce("Hard requirements: output only the premise.");

    await expect(
      generateStoryPremise(DEFAULT_SETTINGS.llm, baseInput),
    ).resolves.toEqual({
      premise:
        "Someone who thought they were only passing through arrives at a place that no longer feels entirely connected to the outside world to deal with the problem everyone there has learned not to name. Before they can settle in, the first real piece of evidence already knows more about their next move than they do.",
    });
  });

  it("builds a tag-aware emergency fallback when placeholder text exhausts every attempt", async () => {
    const taggedInput = {
      language: "en" as const,
      selectedTags: [
        { id: "space", label: "Space", isCustom: false },
        { id: "horror", label: "Horror", isCustom: false },
        { id: "detective", label: "Detective", isCustom: false },
      ],
    };

    vi.mocked(generateLlmText)
      .mockResolvedValueOnce("...")
      .mockResolvedValueOnce("A direct user-facing story premise goes here.");

    await expect(
      generateStoryPremise(DEFAULT_SETTINGS.llm, taggedInput),
    ).resolves.toEqual({
      premise:
        "A detective arrives aboard a drifting space station to get through what should have been an ordinary assignment. But the first log they open already contains a line that should only be written after they die there.",
    });
  });

  it("rejects unrelated tag-missing outputs and falls back to the local tag-aware emergency premise", async () => {
    const taggedInput = {
      language: "zh" as const,
      selectedTags: [
        { id: "underwater", label: "水下世界", isCustom: false },
        { id: "thrilling", label: "紧张刺激", isCustom: false },
        { id: "wanderer", label: "流浪者", isCustom: false },
      ],
    };

    vi.mocked(generateLlmText)
      .mockResolvedValueOnce(
        "一名图书馆管理员在闭馆后发现书架会偷偷调换位置。等她找到最后一排时，昨天借走的那本书已经写好了她明天才会做出的选择。",
      )
      .mockResolvedValueOnce(
        "一名夜班护士在旧城区照看一位拒绝说话的老人。可每到凌晨两点，病房里的收音机都会播出她从未经历过的回忆。",
      );

    await expect(
      generateStoryPremise(DEFAULT_SETTINGS.llm, taggedInput),
    ).resolves.toEqual({
      premise:
        "一名流浪者来到沉在寂静海下的水下聚落，打算抢在局势彻底失控前先看清它的走向。可他每躲开一次险境，前方就会先一步出现他刚才才做出的选择痕迹。",
    });
  });

  it("uses a sharper secondary mood as the emergency hook when multiple mood tags are present", async () => {
    const taggedInput = {
      language: "zh" as const,
      selectedTags: [
        { id: "dungeon", label: "地下城", isCustom: false },
        { id: "warrior", label: "战士", isCustom: false },
        { id: "passionate", label: "热血", isCustom: false },
        { id: "thrilling", label: "紧张刺激", isCustom: false },
      ],
    };

    vi.mocked(generateLlmText)
      .mockResolvedValueOnce("...")
      .mockResolvedValueOnce("输出格式：只输出故事前提正文。");

    await expect(
      generateStoryPremise(DEFAULT_SETTINGS.llm, taggedInput),
    ).resolves.toEqual({
      premise:
        "一名疲惫的战士来到被封死的地下迷宫，决心证明自己能扛住这里最难的一次考验。可他每躲开一次险境，前方就会先一步出现他刚才才做出的选择痕迹。",
    });
  });

  it("varies the local fallback for the same tags when the variation hint changes", () => {
    const sharedInput = {
      language: "zh" as const,
      selectedTags: [
        { id: "dungeon", label: "地下城", isCustom: false },
        { id: "warrior", label: "战士", isCustom: false },
        { id: "thrilling", label: "紧张刺激", isCustom: false },
      ],
    };

    const first = buildLocalPremiseFallback({
      ...sharedInput,
      variationHint: "从一个被提前记录下来的未来痕迹切入（变化码 a1b2）",
    });
    const second = buildLocalPremiseFallback({
      ...sharedInput,
      variationHint: "让异常先出现，原因暂时缺席（变化码 z9x8）",
    });

    expect(first.premise).not.toEqual(second.premise);
  });
});
