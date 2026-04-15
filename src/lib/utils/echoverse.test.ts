import { describe, expect, it } from "vitest";
import { buildDownloadFilename, extractJsonFromText, sanitizeFilenameBase } from "@/lib/utils/echoverse";

describe("extractJsonFromText", () => {
  it("parses fenced json responses", () => {
    expect(
      extractJsonFromText<{ premise: string }>("```json\n{\"premise\":\"A radio host hears tomorrow's news tonight.\"}\n```"),
    ).toEqual({
      premise: "A radio host hears tomorrow's news tonight.",
    });
  });

  it("extracts the first json object from surrounding text", () => {
    expect(
      extractJsonFromText<{ premise: string }>(
        "Here is the result:\n{\"premise\":\"A courier finds letters addressed to disasters that have not happened yet.\"}\nUse it directly.",
      ),
    ).toEqual({
      premise: "A courier finds letters addressed to disasters that have not happened yet.",
    });
  });

  it("parses double-encoded json strings", () => {
    expect(
      extractJsonFromText<{ premise: string }>(
        "\"{\\\"premise\\\":\\\"A diver finds a chapel growing inside a flooded subway tunnel.\\\"}\"",
      ),
    ).toEqual({
      premise: "A diver finds a chapel growing inside a flooded subway tunnel.",
    });
  });

  it("repairs truncated json when only the closing syntax is missing", () => {
    expect(
      extractJsonFromText<{ premise: string }>(
        "{\"premise\":\"A museum guard hears a painting whisper her name\"",
      ),
    ).toEqual({
      premise: "A museum guard hears a painting whisper her name",
    });
  });
});

describe("sanitizeFilenameBase", () => {
  it("preserves non-ascii story titles", () => {
    expect(sanitizeFilenameBase("不夜城还在")).toBe("不夜城还在");
  });

  it("removes invalid Windows filename characters", () => {
    expect(sanitizeFilenameBase("终章: 雨夜/回声?*")).toBe("终章_ 雨夜_回声_");
  });

  it("falls back when the title is empty after sanitizing", () => {
    expect(sanitizeFilenameBase("  <>:\"/\\\\|?*  ", "story_42")).toBe("story_42");
  });

  it("avoids Windows reserved file names", () => {
    expect(sanitizeFilenameBase("CON")).toBe("CON_file");
  });
});

describe("buildDownloadFilename", () => {
  it("appends the requested extension to unicode titles", () => {
    expect(buildDownloadFilename("不夜城还在", ".mp3")).toBe("不夜城还在.mp3");
  });
});
