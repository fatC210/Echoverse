import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateMusicTrack,
  generateSoundEffect,
  listElevenLabsVoices,
} from "./elevenlabs";

const settings = {
  apiKey: "xi_test_key",
  verifiedApiKey: "xi_test_key",
};

describe("listElevenLabsVoices", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests only ElevenLabs default voices and excludes user-created voices", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          voices: [
            {
              voice_id: "official-premade",
              name: "Sarah",
              category: "premade",
            },
            {
              voice_id: "official-default",
              name: "River",
              voice_type: "default",
            },
            {
              voice_id: "custom-clone",
              name: "My Clone",
              category: "cloned",
            },
            {
              voice_id: "community-voice",
              name: "Community Voice",
              voice_type: "community",
            },
          ],
          has_more: false,
          next_page_token: null,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await expect(listElevenLabsVoices(settings)).resolves.toEqual([
      {
        voice_id: "official-premade",
        name: "Sarah",
        category: "premade",
      },
      {
        voice_id: "official-default",
        name: "River",
        voice_type: "default",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/elevenlabs/v2/voices?voice_type=default&page_size=100&include_total_count=false",
      expect.objectContaining({
        method: "GET",
      }),
    );

    const headers = fetchMock.mock.calls[0]?.[1]?.headers;
    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get("xi-api-key")).toBe(settings.apiKey);
  });
});

describe("audio generation requests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the current sound effects payload shape expected by ElevenLabs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Blob(["audio"], { type: "audio/mpeg" }), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
        },
      }),
    );

    await generateSoundEffect(settings, "soft rain on metal", 6, true);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/elevenlabs/v1/sound-generation",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(body.duration_seconds).toBe(6);
    expect(body.prompt_influence).toBe(0.3);
    expect(body.loop).toBe(true);
    expect(body.text).toContain("soft rain on metal");
    expect(body.text).toContain("Non-verbal ambient sound effect only");
    expect(body.text).toContain("No speech");
  });

  it("calls the current ElevenLabs music endpoint with output format as a query parameter", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Blob(["audio"], { type: "audio/mpeg" }), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
        },
      }),
    );

    await generateMusicTrack(settings, "slow ambient pulse", 20);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/elevenlabs/v1/music?output_format=mp3_standard",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(body.music_length_ms).toBe(20000);
    expect(body.force_instrumental).toBe(true);
    expect(body.prompt).toContain("slow ambient pulse");
    expect(body.prompt).toContain("Instrumental background music only");
    expect(body.prompt).toContain("No vocals");
  });
});
