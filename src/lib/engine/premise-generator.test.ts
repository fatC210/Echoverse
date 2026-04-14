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

  it("still rejects prompt-leak instruction text when every attempt is unusable", async () => {
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
    ).rejects.toThrow("Premise was invalid");
  });

  it("still rejects placeholder premise text after exhausting structured and fallback attempts", async () => {
    vi.mocked(generateStructuredJson)
      .mockResolvedValueOnce({
        premise: "...",
      })
      .mockResolvedValueOnce({
        premise: "A direct user-facing story premise goes here.",
      });
    vi.mocked(generateLlmText).mockResolvedValue("...");

    await expect(
      generateStoryPremise(DEFAULT_SETTINGS.llm, baseInput),
    ).rejects.toThrow("Premise was invalid");
  });
});
