import type { EchoSettings } from "@/lib/constants/defaults";

type TurbopufferSettings = EchoSettings["turbopuffer"];

function buildHeaders(settings: TurbopufferSettings, extra?: HeadersInit) {
  return {
    "Content-Type": "application/json",
    "x-turbopuffer-api-key": settings.apiKey,
    "x-turbopuffer-base-url": settings.baseUrl,
    ...extra,
  };
}

async function requestJson<T>(path: string, settings: TurbopufferSettings, init?: RequestInit) {
  const response = await fetch(`/api/turbopuffer/${path}`, {
    ...init,
    headers: buildHeaders(settings, init?.headers),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || "turbopuffer request failed");
  }

  return (await response.json()) as T;
}

export async function testTurbopufferConnection(settings: TurbopufferSettings) {
  await requestJson("v1/namespaces", settings, {
    method: "GET",
  });

  return true;
}

export async function writeNamespaceRows(
  settings: TurbopufferSettings,
  namespace: string,
  rows: Array<Record<string, unknown>>,
) {
  return requestJson(`v2/namespaces/${namespace}`, settings, {
    method: "POST",
    body: JSON.stringify({
      upsert_rows: rows,
    }),
  });
}

export async function queryNamespace<T = Record<string, unknown>>(
  settings: TurbopufferSettings,
  namespace: string,
  body: Record<string, unknown>,
) {
  return requestJson<T>(`v2/namespaces/${namespace}/query`, settings, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
