import { describe, expect, it } from "vitest";
import {
  extractGeneratedPremise,
  isMeaningfulPremise,
  normalizeGeneratedPremise,
} from "@/lib/utils/premise";

describe("premise utils", () => {
  it("normalizes labels and wrapping quotes from generated premises", () => {
    expect(
      normalizeGeneratedPremise(
        '\u6545\u4e8b\u524d\u63d0\uff1a\n\u201c\u66b4\u96e8\u591c\u91cc\uff0c\u4e00\u540d\u5931\u5fc6\u7684\u8239\u533b\u5728\u6e2f\u53e3\u9192\u6765\u3002\u201d',
      ),
    ).toBe("\u66b4\u96e8\u591c\u91cc\uff0c\u4e00\u540d\u5931\u5fc6\u7684\u8239\u533b\u5728\u6e2f\u53e3\u9192\u6765\u3002");
  });

  it("rejects placeholder-only premise outputs", () => {
    expect(isMeaningfulPremise("...")).toBe(false);
    expect(isMeaningfulPremise("A direct user-facing story premise goes here.")).toBe(false);
    expect(
      isMeaningfulPremise("\u8fd9\u91cc\u662f\u4e00\u6bb5\u53ef\u76f4\u63a5\u5c55\u793a\u7ed9\u7528\u6237\u7684\u6545\u4e8b\u524d\u63d0"),
    ).toBe(false);
  });

  it("accepts concrete generated premises", () => {
    expect(
      isMeaningfulPremise(
        "\u4e00\u540d\u521a\u642c\u5230\u5c71\u57ce\u7684\u914d\u97f3\u6f14\u5458\u53d1\u73b0\uff0c\u81ea\u5df1\u6bcf\u665a\u5f55\u4e0b\u7684\u7761\u524d\u5907\u5fd8\u90fd\u4f1a\u5728\u7b2c\u4e8c\u5929\u53d8\u6210\u771f\u5b9e\u7ebf\u7d22\u3002",
      ),
    ).toBe(true);
  });

  it("extracts premise text from common valid response shapes", () => {
    expect(
      extractGeneratedPremise({
        story_premise: "A botanist receives seed packets labeled with disasters that have not happened yet.",
      }),
    ).toBe("A botanist receives seed packets labeled with disasters that have not happened yet.");

    expect(
      extractGeneratedPremise({
        premise: {
          text: "A diver maps a flooded chapel that seems to remember every prayer spoken inside it.",
        },
      }),
    ).toBe("A diver maps a flooded chapel that seems to remember every prayer spoken inside it.");

    expect(
      extractGeneratedPremise({
        output: [
          {
            text: "A violin restorer finds tomorrow's apologies hidden in the varnish of a damaged instrument.",
          },
        ],
      }),
    ).toBe("A violin restorer finds tomorrow's apologies hidden in the varnish of a damaged instrument.");

    expect(
      extractGeneratedPremise({
        status: "ok",
        language: "en",
        message: {
          content:
            "{\"premise\":\"A night archivist discovers the missing pages in her library are being checked out by events that have not happened yet.\"}",
        },
      }),
    ).toBe(
      "A night archivist discovers the missing pages in her library are being checked out by events that have not happened yet.",
    );
  });
});
