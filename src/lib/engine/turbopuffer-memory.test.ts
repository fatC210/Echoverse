import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/constants/defaults";
import { queryNamespace } from "@/lib/services/turbopuffer";
import { findRemoteAudioAssetMatch } from "./turbopuffer-memory";

vi.mock("@/lib/services/turbopuffer", () => ({
  queryNamespace: vi.fn(),
  writeNamespaceRows: vi.fn(),
}));

describe("findRemoteAudioAssetMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries without the category filter when the namespace does not expose that attribute yet", async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      turbopuffer: {
        ...DEFAULT_SETTINGS.turbopuffer,
        apiKey: "tpuf-test",
      },
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    vi.mocked(queryNamespace)
      .mockRejectedValueOnce(
        new Error('{"error":"filter error in key `category`: attribute not found","status":"error"}'),
      )
      .mockResolvedValueOnce({
        rows: [
          {
            id: "audio_asset:sfx_1",
            asset_id: "sfx_1",
            category: "sfx",
            $dist: 0.03,
          },
        ],
      });

    const match = await findRemoteAudioAssetMatch(
      settings,
      "story_1",
      "sfx",
      [0.1, 0.2, 0.3],
      0.9,
    );

    expect(match).toEqual({
      assetId: "sfx_1",
      score: 0.97,
    });
    expect(queryNamespace).toHaveBeenCalledTimes(2);
    expect(vi.mocked(queryNamespace).mock.calls[0]?.[2]).toMatchObject({
      filters: [
        "And",
        [
          ["type", "In", ["audio_asset"]],
          ["category", "Eq", "sfx"],
        ],
      ],
    });
    expect(vi.mocked(queryNamespace).mock.calls[1]?.[2]).toMatchObject({
      filters: ["type", "In", ["audio_asset"]],
    });
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
