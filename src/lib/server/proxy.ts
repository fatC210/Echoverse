function hasRequestBody(method: string) {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

function sanitizeResponseHeaders(headers: Headers) {
  const nextHeaders = new Headers(headers);

  // The upstream fetch body may already be decoded by the runtime. Forwarding
  // the original encoding and length headers can make browsers reject the
  // response with a network-level decoding error ("Failed to fetch").
  nextHeaders.delete("content-encoding");
  nextHeaders.delete("content-length");
  nextHeaders.delete("transfer-encoding");

  return nextHeaders;
}

export async function proxyRequest(
  request: Request,
  upstreamUrl: URL,
  upstreamHeaders: HeadersInit,
) {
  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    body: hasRequestBody(request.method) ? await request.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  });

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers: sanitizeResponseHeaders(response.headers),
  });
}
