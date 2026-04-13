import { describe, expect, it } from "vitest";
import { getStoryTagLabel, isPresetStoryTag } from "./story-tags";

describe("story tag helpers", () => {
  it("returns localized labels for preset tags", () => {
    expect(getStoryTagLabel("space", "en")).toBe("Space");
    expect(getStoryTagLabel("space", "zh")).not.toBe("space");
  });

  it("falls back to the raw tag for custom tags", () => {
    expect(getStoryTagLabel("时间循环", "zh")).toBe("时间循环");
    expect(isPresetStoryTag("时间循环")).toBe(false);
  });

  it("identifies preset tags by id", () => {
    expect(isPresetStoryTag("space")).toBe(true);
  });
});
