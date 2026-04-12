import { proxyRequest } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

function ensureBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim();

  if (!normalized) {
    throw new Error("Missing x-llm-base-url header");
  }

  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

export async function POST(request: Request) {
  try {
    const baseUrl = ensureBaseUrl(request.headers.get("x-llm-base-url") ?? "");
    const apiKey = request.headers.get("x-llm-api-key") ?? "";
    const model = request.headers.get("x-llm-model") ?? "";
    const body = await request.json();

    if (!apiKey || !model) {
      return Response.json(
        { error: "Missing LLM configuration headers" },
        { status: 400 },
      );
    }

    const upstreamUrl = new URL("chat/completions", baseUrl);

    return proxyRequest(
      new Request(request.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          ...body,
        }),
      }),
      upstreamUrl,
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "LLM proxy request failed",
      },
      { status: 502 },
    );
  }
}
