import {
  resolveLlmSettings,
  type EchoSettings,
} from "@/lib/constants/defaults";
import {
  extractJsonFromText,
  extractJsonResultFromText,
} from "@/lib/utils/echoverse";

type LlmSettings = EchoSettings["llm"];

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  response_format?: Record<string, unknown>;
}

interface ChatContentPart {
  type?: string;
  text?: string;
}

interface ChatChoice {
  finish_reason?: string | null;
  message?: {
    content?: string | ChatContentPart[];
  };
}

interface ChatResponse {
  choices?: ChatChoice[];
}

const DEFAULT_JSON_RESPONSE_FORMAT = { type: "json_object" } as const;

const JSON_RETRY_PROMPT =
  "Your previous reply was not valid JSON. Return the full answer again as exactly one complete JSON object. Do not use markdown fences. Do not include commentary before or after the JSON. Keep all descriptions concise so the response fits comfortably within the token limit.";

const JSON_REPAIR_SYSTEM_PROMPT =
  "You repair malformed JSON produced by another model. Return exactly one valid JSON object. Preserve the original meaning when it is clear, remove markdown or commentary, and only fill in obviously truncated syntax conservatively.";

interface ChatResult {
  content: string;
  finishReason: string | null;
}

export class LlmRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LlmRequestError";
    this.status = status;
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string" &&
    payload.error.message.trim()
  ) {
    return payload.error.message.trim();
  }

  if ("error" in payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  if ("message" in payload && typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  if ("detail" in payload && typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail.trim();
  }

  if (
    "detail" in payload &&
    payload.detail &&
    typeof payload.detail === "object" &&
    "message" in payload.detail &&
    typeof payload.detail.message === "string" &&
    payload.detail.message.trim()
  ) {
    return payload.detail.message.trim();
  }

  return null;
}

async function readLlmError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as unknown;
      const message = extractErrorMessage(payload);

      return new LlmRequestError(
        message ?? `LLM request failed (${response.status})`,
        response.status,
      );
    } catch {
      // Fall through to plain text parsing.
    }
  }

  const text = (await response.text()).trim();
  return new LlmRequestError(
    text || `LLM request failed (${response.status})`,
    response.status,
  );
}

function shouldRetryWithoutStructuredMode(error: unknown) {
  if (!(error instanceof LlmRequestError)) {
    return false;
  }

  return (
    error.status >= 400 &&
    error.status < 500 &&
    /response_format|json_object|json schema|unsupported|not supported|unknown parameter|invalid parameter/i.test(
      error.message,
    )
  );
}

function shouldRetryTransientError(error: unknown) {
  if (error instanceof LlmRequestError) {
    return error.status >= 500;
  }

  return error instanceof TypeError;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildHeaders(settings: LlmSettings, extra?: HeadersInit) {
  const resolved = resolveLlmSettings(settings);

  return {
    "Content-Type": "application/json",
    "x-llm-base-url": resolved.baseUrl,
    "x-llm-api-key": settings.apiKey,
    "x-llm-model": resolved.model,
    "x-embedding-model": resolved.embeddingModel,
    ...extra,
  };
}

function extractChatContent(content: string | ChatContentPart[] | undefined) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (typeof part?.text === "string") {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
}

function formatResponseSnippet(content: string, maxLength = 500) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function getRetryOptions(options?: ChatOptions): ChatOptions {
  const currentMaxTokens = options?.max_tokens ?? 2200;

  return {
    ...options,
    temperature: 0,
    max_tokens: Math.min(Math.max(currentMaxTokens + 800, Math.ceil(currentMaxTokens * 1.4)), 4096),
  };
}

function buildStructuredJsonErrorMessage(attempts: ChatResult[]) {
  const finishReasons = attempts
    .map((attempt, index) => `attempt ${index + 1}: ${attempt.finishReason ?? "unknown"}`)
    .join(", ");
  const snippets = attempts
    .map(
      (attempt, index) =>
        `attempt ${index + 1} snippet: "${formatResponseSnippet(attempt.content)}"`,
    )
    .join(" ");

  return `Could not parse JSON from model response. Finish reasons: ${finishReasons}. ${snippets}`;
}

function buildJsonRepairMessages(content: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: JSON_REPAIR_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `Repair this malformed JSON-like response into one valid JSON object only:\n\n${content}`,
    },
  ];
}

function pickJsonRepairSource(attempts: ChatResult[]) {
  return [...attempts].sort((left, right) => right.content.length - left.content.length)[0]?.content ?? "";
}

async function requestChatDetailedOnce(
  settings: LlmSettings,
  messages: ChatMessage[],
  options?: ChatOptions,
): Promise<ChatResult> {
  const response = await fetch("/api/llm/chat", {
    method: "POST",
    headers: buildHeaders(settings),
    body: JSON.stringify({
      messages,
      ...options,
    }),
  });

  if (!response.ok) {
    throw await readLlmError(response);
  }

  const payload = (await response.json()) as ChatResponse;
  const choice = payload.choices?.[0];
  const content = extractChatContent(choice?.message?.content);

  if (!content) {
    throw new Error("LLM response was empty");
  }

  return {
    content,
    finishReason: choice?.finish_reason ?? null,
  };
}

async function requestChatDetailed(
  settings: LlmSettings,
  messages: ChatMessage[],
  options?: ChatOptions,
): Promise<ChatResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await requestChatDetailedOnce(settings, messages, options);
    } catch (error) {
      lastError = error;

      if (!shouldRetryTransientError(error) || attempt === 1) {
        throw error;
      }

      await sleep(300 * (attempt + 1));
    }
  }

  throw lastError;
}

async function requestChat(settings: LlmSettings, messages: ChatMessage[], options?: ChatOptions) {
  const result = await requestChatDetailed(settings, messages, options);
  return result.content;
}

async function requestStructuredChat(
  settings: LlmSettings,
  messages: ChatMessage[],
  options?: ChatOptions,
): Promise<ChatResult> {
  try {
    return await requestChatDetailed(settings, messages, {
      ...options,
      response_format: options?.response_format ?? DEFAULT_JSON_RESPONSE_FORMAT,
    });
  } catch (error) {
    if (!shouldRetryWithoutStructuredMode(error)) {
      throw error;
    }
  }

  return requestChatDetailed(settings, messages, options);
}

function buildJsonRetryMessages(messages: ChatMessage[], finishReason: string | null): ChatMessage[] {
  const retryPrompt =
    finishReason === "length"
      ? `${JSON_RETRY_PROMPT} The previous reply was cut off before completion, so shorten descriptions and arrays if needed.`
      : JSON_RETRY_PROMPT;

  return [
    ...messages,
    { role: "user", content: retryPrompt },
  ];
}

function shouldAcceptStructuredJsonResult(
  finishReason: string | null,
  repaired: boolean,
) {
  if (repaired) {
    return false;
  }

  if (finishReason === "length") {
    return false;
  }

  return true;
}

export async function testLlmConnection(settings: LlmSettings) {
  await requestChat(
    settings,
    [
      {
        role: "system",
        content: "Reply with exactly OK.",
      },
      {
        role: "user",
        content: "OK",
      },
    ],
    {
      temperature: 0,
      max_tokens: 5,
    },
  );

  return true;
}

export async function generateLlmText(
  settings: LlmSettings,
  messages: ChatMessage[],
  options?: ChatOptions,
) {
  return requestChat(settings, messages, options);
}

export async function generateStructuredJson<T>(
  settings: LlmSettings,
  messages: ChatMessage[],
  options?: ChatOptions,
) {
  const firstAttempt = await requestStructuredChat(settings, messages, options);

  try {
    const parsed = extractJsonResultFromText<T>(firstAttempt.content);

    if (shouldAcceptStructuredJsonResult(firstAttempt.finishReason, parsed.repaired)) {
      return parsed.value;
    }
  } catch (error) {
    if (!(error instanceof Error) || !/Could not parse JSON from model response|Empty response/i.test(error.message)) {
      throw error;
    }
  }

  const secondAttempt = await requestStructuredChat(
    settings,
    buildJsonRetryMessages(messages, firstAttempt.finishReason),
    getRetryOptions(options),
  );

  try {
    const parsed = extractJsonResultFromText<T>(secondAttempt.content);

    if (shouldAcceptStructuredJsonResult(secondAttempt.finishReason, parsed.repaired)) {
      return parsed.value;
    }
  } catch (retryError) {
    const repairSource = pickJsonRepairSource([firstAttempt, secondAttempt]);

    if (repairSource) {
      let repairAttempt: ChatResult | null = null;

      try {
        repairAttempt = await requestStructuredChat(
          settings,
          buildJsonRepairMessages(repairSource),
          getRetryOptions(options),
        );

        return extractJsonFromText<T>(repairAttempt.content);
      } catch (repairError) {
        const errorMessage = buildStructuredJsonErrorMessage(
          repairAttempt
            ? [firstAttempt, secondAttempt, repairAttempt]
            : [firstAttempt, secondAttempt],
        );
        console.error("Structured JSON generation failed", {
          error: repairError instanceof Error ? repairError.message : String(repairError),
          firstAttempt,
          secondAttempt,
          repairAttempt,
        });

        throw new Error(errorMessage);
      }
    }

    const errorMessage = buildStructuredJsonErrorMessage([firstAttempt, secondAttempt]);
    console.error("Structured JSON generation failed", {
      error: retryError instanceof Error ? retryError.message : String(retryError),
      firstAttempt,
      secondAttempt,
    });

    throw new Error(errorMessage);
  }

  const repairSource = pickJsonRepairSource([firstAttempt, secondAttempt]);

  if (repairSource) {
    let repairAttempt: ChatResult | null = null;

    try {
      repairAttempt = await requestStructuredChat(
        settings,
        buildJsonRepairMessages(repairSource),
        getRetryOptions(options),
      );

      return extractJsonFromText<T>(repairAttempt.content);
    } catch (repairError) {
      const errorMessage = buildStructuredJsonErrorMessage(
        repairAttempt
          ? [firstAttempt, secondAttempt, repairAttempt]
          : [firstAttempt, secondAttempt],
      );
      console.error("Structured JSON generation failed", {
        error: repairError instanceof Error ? repairError.message : String(repairError),
        firstAttempt,
        secondAttempt,
        repairAttempt,
      });

      throw new Error(errorMessage);
    }
  }

  const errorMessage = buildStructuredJsonErrorMessage([firstAttempt, secondAttempt]);
  console.error("Structured JSON generation failed", {
    error: "Model responses were only recoverable via truncation repair.",
    firstAttempt,
    secondAttempt,
  });

  throw new Error(errorMessage);
}

export async function createEmbeddings(settings: LlmSettings, input: string | string[]) {
  const response = await fetch("/api/llm/embeddings", {
    method: "POST",
    headers: buildHeaders(settings),
    body: JSON.stringify({
      input,
    }),
  });

  if (!response.ok) {
    throw await readLlmError(response);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
    disabled?: boolean;
    error?: string;
    status?: number;
  };

  if (payload.disabled) {
    throw new LlmRequestError(
      payload.error ?? "Embeddings are unavailable for the current provider configuration",
      payload.status ?? 400,
    );
  }

  return (payload.data ?? []).map((entry) => entry.embedding ?? []);
}
