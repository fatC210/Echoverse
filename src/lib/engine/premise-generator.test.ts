import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/constants/defaults";
import { generateLlmText, generateStructuredJson } from "@/lib/services/llm";
import { generateStoryPremise } from "./premise-generator";

vi.mock("@/lib/services/llm", () => ({
  generateLlmText: vi.fn(),
  generateStructuredJson: vi.fn(),
}));

const baseInput = {
  language: "en" as const,
  selectedTags: [] as Array<{ id: string; label: string; isCustom: boolean }>,
};

describe("generateStoryPremise", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a parseable JSON premise when it is presentable even if it misses the strict hook check", async () => {
    vi.mocked(generateStructuredJson).mockResolvedValue({
      premise:
        "A conservatory pianist returns to her hometown to catalog the instruments left in a shuttered theater. On her first night back, the stage is already set for a recital nobody has announced.",
    });

    const result = await generateStoryPremise(DEFAULT_SETTINGS.llm, baseInput);

    expect(result).toEqual({
      premise:
        "A conservatory pianist returns to her hometown to catalog the instruments left in a shuttered theater. On her first night back, the stage is already set for a recital nobody has announced.",
    });
    expect(generateStructuredJson).toHaveBeenCalledTimes(1);
    expect(generateLlmText).not.toHaveBeenCalled();
  });

  it("falls back to plain text generation when structured JSON parsing keeps failing", async () => {
    vi.mocked(generateStructuredJson).mockRejectedValue(
      new Error("Could not parse JSON from model response"),
    );
    vi.mocked(generateLlmText).mockResolvedValue(
      "A courier wakes to find a train ticket stamped for a city that disappeared from the map last winter. When tonight's departure board starts listing her childhood home as the final stop, she has one evening to learn who reopened the line.",
    );

    const result = await generateStoryPremise(DEFAULT_SETTINGS.llm, baseInput);

    expect(result).toEqual({
      premise:
        "A courier wakes to find a train ticket stamped for a city that disappeared from the map last winter. When tonight's departure board starts listing her childhood home as the final stop, she has one evening to learn who reopened the line.",
    });
    expect(generateStructuredJson).toHaveBeenCalledTimes(2);
    expect(generateLlmText).toHaveBeenCalledTimes(1);
  });

  it("retries when a parseable premise does not clearly reflect the selected tags", async () => {
    const taggedInput = {
      language: "en" as const,
      selectedTags: [
        { id: "space", label: "Space", isCustom: false },
        { id: "horror", label: "Horror", isCustom: false },
        { id: "detective", label: "Detective", isCustom: false },
      ],
    };

    vi.mocked(generateStructuredJson)
      .mockResolvedValueOnce({
        premise:
          "A courier discovers a suitcase that arrives one day before every disaster. When the case appears with her own address on it, she has one night to learn who is sending warnings from tomorrow.",
      })
      .mockResolvedValueOnce({
        premise:
          "A terrified detective arrives aboard a drifting space station to get through what should have been an ordinary assignment. When the first corpse opens its eyes after lights-out, he realizes the thing waiting in the dark already knows his name.",
      });

    const result = await generateStoryPremise(DEFAULT_SETTINGS.llm, taggedInput);

    expect(result).toEqual({
      premise:
        "A terrified detective arrives aboard a drifting space station to get through what should have been an ordinary assignment. When the first corpse opens its eyes after lights-out, he realizes the thing waiting in the dark already knows his name.",
    });
    expect(generateStructuredJson).toHaveBeenCalledTimes(2);
    expect(generateLlmText).not.toHaveBeenCalled();
  });

  it("cleans labels and markdown fences from fallback text before accepting it", async () => {
    vi.mocked(generateStructuredJson)
      .mockResolvedValueOnce({
        premise: "...",
      })
      .mockResolvedValueOnce({
        premise: "Output format: write exactly 2 to 3 sentences.",
      });
    vi.mocked(generateLlmText).mockResolvedValue(
      "```text\nPremise: A lighthouse mechanic takes the winter shift on an island whose beacon was retired decades ago.\n```",
    );

    const result = await generateStoryPremise(DEFAULT_SETTINGS.llm, baseInput);

    expect(result).toEqual({
      premise:
        "A lighthouse mechanic takes the winter shift on an island whose beacon was retired decades ago.",
    });
  });

  it("returns an emergency fallback premise when every attempt is unusable", async () => {
    vi.mocked(generateStructuredJson)
      .mockResolvedValueOnce({
        premise: "Output format: write exactly 2 to 3 sentences.",
      })
      .mockResolvedValueOnce({
        premise: "Tags: Space, Horror. Use these tags to build the story premise.",
      });
    vi.mocked(generateLlmText).mockResolvedValue(
      "Hard requirements: return JSON only. Do not output anything except the premise field.",
    );

    await expect(
      generateStoryPremise(DEFAULT_SETTINGS.llm, baseInput),
    ).resolves.toEqual({
      premise:
        "Someone who thought they were only passing through arrives at a place that no longer feels entirely connected to the outside world to deal with the problem everyone there has learned not to name. Before they can settle in, one small inconsistency suggests the real story there began long before their arrival.",
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

    vi.mocked(generateStructuredJson)
      .mockResolvedValueOnce({
        premise: "...",
      })
      .mockResolvedValueOnce({
        premise: "A direct user-facing story premise goes here.",
      });
    vi.mocked(generateLlmText).mockResolvedValue("...");

    await expect(
      generateStoryPremise(DEFAULT_SETTINGS.llm, taggedInput),
    ).resolves.toEqual({
      premise:
        "A detective arrives aboard a drifting space station to get through what should have been an ordinary assignment. But the first sign that something is wrong feels as if it has been waiting specifically for them.",
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

    vi.mocked(generateStructuredJson)
      .mockResolvedValueOnce({
        premise:
          "一名图书馆管理员在闭馆后发现书架会偷偷调换位置。等她找到最后一排时，昨天借走的那本书已经写好了她明天才会做出的选择。",
      })
      .mockResolvedValueOnce({
        premise:
          "一名夜班护士在旧城区照看一位拒绝说话的老人。可每到凌晨两点，病房里的收音机都会播出她从未经历过的回忆。",
      });
    vi.mocked(generateLlmText).mockResolvedValue(
      "一名博物馆讲解员在新展厅里发现一幅尚未完成的肖像。当天夜里，画布上的眼神先一步认出了她。",
    );

    await expect(
      generateStoryPremise(DEFAULT_SETTINGS.llm, taggedInput),
    ).resolves.toEqual({
      premise:
        "一名流浪者来到沉在寂静海下的水下聚落，打算抢在局势彻底失控前先看清它的走向。可每往前一步，现场都像早有人替他安排好了下一步会撞见的东西。",
    });
  });
});
