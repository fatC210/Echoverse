import { describe, expect, it } from "vitest";
import { extractJsonFromText } from "@/lib/utils/echoverse";

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
