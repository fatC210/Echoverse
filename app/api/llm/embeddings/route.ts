export const dynamic = "force-dynamic";

function ensureBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim();

  if (!normalized) {
    throw new Error("Missing x-llm-base-url header");
  }

  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function sanitizeResponseHeaders(headers: Headers) {
  const nextHeaders = new Headers(headers);
  nextHeaders.delete("content-encoding");
  nextHeaders.delete("content-length");
  nextHeaders.delete("transfer-encoding");
  return nextHeaders;
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

async function readUpstreamError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as unknown;
      return {
        payload,
        message: extractErrorMessage(payload),
      };
    } catch {
      // Fall through to plain text parsing.
    }
  }

  const text = (await response.text()).trim();
  return {
    payload: null,
    message: text || null,
  };
}

function isEmbeddingsCapabilityError(status: number, message: string | null) {
  if (![400, 404, 422].includes(status) || !message) {
    return false;
  }

  return /embedding|model|not available|not found|unsupported|unknown parameter|invalid parameter/i.test(
    message,
  );
}

export async function POST(request: Request) {
  try {
    const baseUrl = ensureBaseUrl(request.headers.get("x-llm-base-url") ?? "");
    const apiKey = request.headers.get("x-llm-api-key") ?? "";
    const embeddingModel = request.headers.get("x-embedding-model") ?? "";
    const body = await request.json();

    if (!apiKey || !embeddingModel) {
      return Response.json(
        { error: "Missing embedding configuration headers" },
        { status: 400 },
      );
    }

    const upstreamUrl = new URL("embeddings", baseUrl);
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: embeddingModel,
        ...body,
      }),
      cache: "no-store",
    });

    if (upstreamResponse.ok) {
      return new Response(await upstreamResponse.arrayBuffer(), {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: sanitizeResponseHeaders(upstreamResponse.headers),
      });
    }

    const { payload, message } = await readUpstreamError(upstreamResponse);

    if (isEmbeddingsCapabilityError(upstreamResponse.status, message)) {
      return Response.json({
        data: [],
        disabled: true,
        error: message,
        status: upstreamResponse.status,
      });
    }

    return Response.json(
      payload ?? {
        error: message ?? `LLM embeddings request failed (${upstreamResponse.status})`,
      },
      { status: upstreamResponse.status },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "LLM embeddings proxy request failed",
      },
      { status: 502 },
    );
  }
}
