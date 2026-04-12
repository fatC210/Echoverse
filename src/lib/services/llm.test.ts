import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/constants/defaults";
import {
  createEmbeddings,
  generateStructuredJson,
  LlmRequestError,
} from "@/lib/services/llm";

const llmSettings = {
  ...DEFAULT_SETTINGS.llm,
  apiKey: "sk-test",
  baseUrl: "https://example.com/v1",
  model: "test-model",
  embeddingModel: "test-embedding-model",
};

describe("generateStructuredJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("retries without response_format when the provider rejects json_object mode", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "response_format json_object is not supported for this model",
            },
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "{\"premise\":\"A lighthouse keeper hears distress calls from a ship that vanished years ago.\"}",
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructuredJson<{ premise: string }>(
      llmSettings,
      [{ role: "user", content: "Generate a premise." }],
    );

    expect(result).toEqual({
      premise: "A lighthouse keeper hears distress calls from a ship that vanished years ago.",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).response_format).toEqual({
      type: "json_object",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).response_format).toBeUndefined();
  });

  it("extracts text content from array-based chat responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: [
                  {
                    type: "text",
                    text: "{\"premise\":\"A train station clock starts counting down to passengers who have not arrived yet.\"}",
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructuredJson<{ premise: string }>(
      llmSettings,
      [{ role: "user", content: "Generate a premise." }],
    );

    expect(result).toEqual({
      premise: "A train station clock starts counting down to passengers who have not arrived yet.",
    });
  });

  it("retries once after a transient 500 response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "upstream temporarily unavailable",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "{\"premise\":\"A ferryman discovers one passenger is listed on tomorrow's manifest instead of tonight's.\"}",
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructuredJson<{ premise: string }>(
      llmSettings,
      [{ role: "user", content: "Generate a premise." }],
    );

    expect(result).toEqual({
      premise: "A ferryman discovers one passenger is listed on tomorrow's manifest instead of tonight's.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries once when the model returns invalid json", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "{\"premise\":\"A museum guard hears a painting whisper her name\"",
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "{\"premise\":\"A museum guard hears a painting whisper her name after closing time.\"}",
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructuredJson<{ premise: string }>(
      llmSettings,
      [{ role: "user", content: "Generate a premise." }],
    );

    expect(result).toEqual({
      premise: "A museum guard hears a painting whisper her name after closing time.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).messages.at(-1)).toEqual({
      role: "user",
      content:
        "Your previous reply was not valid JSON. Return the full answer again as exactly one complete JSON object. Do not use markdown fences. Do not include commentary before or after the JSON. Keep all descriptions concise so the response fits comfortably within the token limit.",
    });
  });

  it("attempts one repair pass after two malformed json responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "{\"premise\":\"A bell tolls from an empty cathedral\"",
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "{\"premise\":\"A bell tolls from an empty cathedral every time the town loses another hour\"",
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    "{\"premise\":\"A bell tolls from an empty cathedral every time the town loses another hour.\"}",
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructuredJson<{ premise: string }>(
      llmSettings,
      [{ role: "user", content: "Generate a premise." }],
    );

    expect(result).toEqual({
      premise: "A bell tolls from an empty cathedral every time the town loses another hour.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body)).messages[0]).toEqual({
      role: "system",
      content:
        "You repair malformed JSON produced by another model. Return exactly one valid JSON object. Preserve the original meaning when it is clear, remove markdown or commentary, and only fill in obviously truncated syntax conservatively.",
    });
  });
});

describe("createEmbeddings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("treats a proxy-disabled embeddings response as a local capability error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [],
            disabled: true,
            error: "text-embedding-3-small not available",
            status: 400,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      ),
    );

    await expect(createEmbeddings(llmSettings, "static crackle")).rejects.toEqual(
      expect.objectContaining<LlmRequestError>({
        name: "LlmRequestError",
        message: "text-embedding-3-small not available",
        status: 400,
      }),
    );
  });
});
