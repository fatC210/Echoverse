import { ELEVENLABS_VOICES } from "@/lib/constants/defaults";
import type { Language, VoiceOption } from "@/lib/types/echoverse";

const localizedVoiceMap = new Map(
  ELEVENLABS_VOICES.map((voice) => [voice.id, voice]),
);

export type VoiceGenderFilter = "all" | "female" | "male";

function extractPrimaryVoiceName(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return "—";
  }

  const englishNameMatch = normalized.match(
    /^[A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*)*/,
  );

  if (englishNameMatch?.[0]) {
    return englishNameMatch[0].trim();
  }

  const [firstSegment] = normalized.split(/\s+-\s+|_|，|,/);
  return firstSegment?.trim() || normalized;
}

function getEnglishVoiceName(
  voiceId: string | null | undefined,
  fallbackName: string | null | undefined,
) {
  if (voiceId) {
    const localizedVoice = localizedVoiceMap.get(voiceId);
    if (localizedVoice) {
      return localizedVoice.name.en;
    }
  }

  return extractPrimaryVoiceName(fallbackName);
}

export function getLocalizedVoiceName(
  voiceId: string | null | undefined,
  fallbackName: string | null | undefined,
  _lang: Language,
) {
  return getEnglishVoiceName(voiceId, fallbackName);
}

export function getVoiceOptionDisplayName(voice: VoiceOption, _lang: Language) {
  return getEnglishVoiceName(voice.voice_id, voice.name);
}

export function getVoiceGender(voice: VoiceOption) {
  const gender = voice.labels?.gender?.trim().toLowerCase();
  return gender === "female" || gender === "male" ? gender : null;
}

export function filterVoicesByGender(
  voices: VoiceOption[],
  filter: VoiceGenderFilter,
) {
  if (filter === "all") {
    return voices;
  }

  return voices.filter((voice) => getVoiceGender(voice) === filter);
}

export function getEmptyVoiceFilterLabel(lang: Language) {
  return lang === "zh"
    ? "当前筛选下没有可用音色。"
    : "No voices match this filter.";
}
