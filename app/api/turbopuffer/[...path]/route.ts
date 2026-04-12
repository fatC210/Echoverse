import { proxyRequest } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

function ensureBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim() || "https://api.turbopuffer.com";
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function buildUpstreamUrl(baseUrl: string, path: string[], request: Request) {
  const upstreamUrl = new URL(path.join("/"), ensureBaseUrl(baseUrl));
  const search = new URL(request.url).search;

  if (search) {
    upstreamUrl.search = search;
  }

  return upstreamUrl;
}

async function handle(request: Request, params: Promise<{ path: string[] }>) {
  const { path } = await params;
  const apiKey = request.headers.get("x-turbopuffer-api-key") ?? "";
  const baseUrl = request.headers.get("x-turbopuffer-base-url") ?? "";

  if (!apiKey) {
    return Response.json(
      { error: "Missing x-turbopuffer-api-key header" },
      { status: 400 },
    );
  }

  return proxyRequest(request, buildUpstreamUrl(baseUrl, path, request), {
    Authorization: `Bearer ${apiKey}`,
    Accept: request.headers.get("accept") ?? "*/*",
    "Content-Type": request.headers.get("content-type") ?? "application/json",
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, context.params);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, context.params);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, context.params);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, context.params);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, context.params);
}
