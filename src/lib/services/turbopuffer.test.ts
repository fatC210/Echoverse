import { afterEach, describe, expect, it, vi } from "vitest";
import { testTurbopufferConnection } from "./turbopuffer";

const settings = {
  apiKey: "tpuf_test_key",
  baseUrl: "https://api.turbopuffer.com",
};

describe("testTurbopufferConnection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("checks namespace access through the v1 listing endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ namespaces: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    await expect(testTurbopufferConnection(settings)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/turbopuffer/v1/namespaces",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-turbopuffer-api-key": settings.apiKey,
          "x-turbopuffer-base-url": settings.baseUrl,
        }),
      }),
    );
  });
});
