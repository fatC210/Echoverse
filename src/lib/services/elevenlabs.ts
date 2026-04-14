import type { EchoSettings } from "@/lib/constants/defaults";
import type { VoiceOption } from "@/lib/types/echoverse";

type ElevenLabsSettings = EchoSettings["elevenlabs"];
const DEFAULT_MUSIC_OUTPUT_FORMAT = "mp3_44100_128";
const ELEVENLABS_DEFAULT_VOICE_PAGE_SIZE = 100;

interface ElevenLabsVoiceListResponse {
  voices?: VoiceOption[];
  has_more?: boolean;
  next_page_token?: string | null;
}

function normalizeApiKey(value?: string) {
  return value?.trim() ?? "";
}

function normalizePromptText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildSoundEffectPrompt(description: string) {
  const prompt = normalizePromptText(description);
  const suffix =
    "Non-verbal ambient sound effect only. No speech, spoken words, narration, dialogue, singing, chanting, or human voice.";

  return prompt ? `${prompt}. ${suffix}` : suffix;
}

function buildMusicPrompt(description: string) {
  const prompt = normalizePromptText(description);
  const suffix =
    "Instrumental background music only. No vocals, spoken words, narration, voiceover, choir, chanting, or human voice.";

  return prompt ? `${prompt}. ${suffix}` : suffix;
}

export function isElevenLabsVerified(settings: ElevenLabsSettings) {
  const apiKey = normalizeApiKey(settings.apiKey);
  const verifiedApiKey = normalizeApiKey(settings.verifiedApiKey);

  return Boolean(apiKey && verifiedApiKey && apiKey === verifiedApiKey);
}

function buildHeaders(settings: ElevenLabsSettings, extra?: HeadersInit) {
  const apiKey = normalizeApiKey(settings.apiKey);

  if (!apiKey) {
    throw new Error("ElevenLabs API key is empty");
  }

  const headers = new Headers(extra);
  headers.set("xi-api-key", apiKey);

  return headers;
}

function getErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("detail" in payload && typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  if (
    "detail" in payload &&
    payload.detail &&
    typeof payload.detail === "object" &&
    "message" in payload.detail &&
    typeof payload.detail.message === "string" &&
    payload.detail.message.trim()
  ) {
    return payload.detail.message;
  }

  if ("message" in payload && typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if ("error" in payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return null;
}

async function readElevenLabsError(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as unknown;
      return getErrorMessage(payload) ?? fallback;
    } catch {
      // Fall through to text parsing.
    }
  }

  const text = await response.text();
  return text.trim() || fallback;
}

async function requestJson<T>(path: string, settings: ElevenLabsSettings, init?: RequestInit) {
  const response = await fetch(`/api/elevenlabs/${path}`, {
    ...init,
    headers: buildHeaders(settings, init?.headers),
  });

  if (!response.ok) {
    throw new Error(await readElevenLabsError(response, "ElevenLabs request failed"));
  }

  return (await response.json()) as T;
}

async function requestAudio(path: string, settings: ElevenLabsSettings, init?: RequestInit) {
  const response = await fetch(`/api/elevenlabs/${path}`, {
    ...init,
    headers: buildHeaders(settings, init?.headers),
  });

  if (!response.ok) {
    throw new Error(await readElevenLabsError(response, "ElevenLabs audio request failed"));
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
  };
}

function isOfficialElevenLabsVoice(voice: VoiceOption) {
  const voiceType = voice.voice_type?.trim().toLowerCase();

  if (voiceType) {
    return voiceType === "default";
  }

  const category = voice.category?.trim().toLowerCase();

  if (category) {
    return category === "premade" || category === "default";
  }

  return true;
}

export async function testElevenLabsConnection(settings: ElevenLabsSettings) {
  await requestJson("v1/user", settings, {
    method: "GET",
  });

  return true;
}

export async function listElevenLabsVoices(settings: ElevenLabsSettings) {
  const collectedVoices: VoiceOption[] = [];
  let nextPageToken: string | null = null;

  do {
    const params = new URLSearchParams({
      voice_type: "default",
      page_size: String(ELEVENLABS_DEFAULT_VOICE_PAGE_SIZE),
      include_total_count: "false",
    });

    if (nextPageToken) {
      params.set("next_page_token", nextPageToken);
    }

    const payload = await requestJson<ElevenLabsVoiceListResponse>(
      `v2/voices?${params.toString()}`,
      settings,
      {
        method: "GET",
      },
    );

    collectedVoices.push(
      ...(payload.voices ?? []).filter(isOfficialElevenLabsVoice),
    );
    nextPageToken = payload.has_more ? payload.next_page_token ?? null : null;
  } while (nextPageToken);

  return collectedVoices;
}

export async function previewElevenLabsVoice(settings: ElevenLabsSettings, voiceId: string, text: string) {
  return requestAudio(`v1/text-to-speech/${voiceId}`, settings, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
    }),
  });
}

export async function generateNarrationSpeech(
  settings: ElevenLabsSettings,
  voiceId: string,
  text: string,
) {
  return requestAudio(`v1/text-to-speech/${voiceId}`, settings, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_v3",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.7,
      },
    }),
  });
}

export async function generateSoundEffect(
  settings: ElevenLabsSettings,
  description: string,
  durationSec: number,
  looping: boolean,
) {
  return requestAudio("v1/sound-generation", settings, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: buildSoundEffectPrompt(description),
      duration_seconds: durationSec || undefined,
      prompt_influence: 0.3,
      loop: looping,
    }),
  });
}

export async function generateMusicTrack(
  settings: ElevenLabsSettings,
  description: string,
  durationSec: number,
) {
  return requestAudio(
    `v1/music?${new URLSearchParams({ output_format: DEFAULT_MUSIC_OUTPUT_FORMAT }).toString()}`,
    settings,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        prompt: buildMusicPrompt(description),
        music_length_ms: durationSec * 1000,
        force_instrumental: true,
      }),
    },
  );
}
