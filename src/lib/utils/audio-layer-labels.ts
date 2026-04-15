import { MOOD_MAP, type MoodType } from "@/lib/constants/moods";
import { t } from "@/lib/i18n";

type InterfaceLang = "en" | "zh";
type AudioLayerType = "sfx" | "music";

type LocalizedText = Record<InterfaceLang, string>;
type KeywordRule = {
  group?: string;
  label: LocalizedText;
  patterns: RegExp[];
};

const KEYWORD_RULES: Record<AudioLayerType, KeywordRule[]> = {
  sfx: [
    {
      group: "resonance",
      label: { en: "Stone resonance", zh: "石壁共振" },
      patterns: [/(stone|rock|granite|monolith|wall|cavern|chamber)/, /(resonan|vibrat|rumble|pulse|hum|drone)/],
    },
    {
      group: "metal",
      label: { en: "Metal scrape", zh: "金属摩擦" },
      patterns: [/(metal|chain|iron|steel|clang|clank|scrape|grind)/],
    },
    {
      group: "door",
      label: { en: "Door strain", zh: "门扉异响" },
      patterns: [/(door|gate|hinge|lock|latch)/],
    },
    {
      group: "steps",
      label: { en: "Footsteps", zh: "脚步声" },
      patterns: [/(footstep|footsteps|steps|boot|tread)/],
    },
    {
      group: "wind",
      label: { en: "Wind", zh: "风声" },
      patterns: [/(wind|gust|breeze|howl|whistle|draft)/],
    },
    {
      group: "water",
      label: { en: "Water", zh: "水声" },
      patterns: [/(water|drip|rain|river|ocean|wave|splash|flood)/],
    },
    {
      group: "fire",
      label: { en: "Fire crackle", zh: "火焰噼啪" },
      patterns: [/(fire|ember|flame|crackle|burn|spark)/],
    },
    {
      group: "voice-like",
      label: { en: "Whisper", zh: "低语" },
      patterns: [/(whisper|hiss|breath|murmur)/],
    },
    {
      group: "mechanical",
      label: { en: "Mechanical", zh: "机械" },
      patterns: [/(machine|engine|gear|mechanic|servo|motor)/],
    },
    {
      group: "chime",
      label: { en: "Bell tone", zh: "铃音" },
      patterns: [/(chime|bell|toll)/],
    },
    {
      group: "echo",
      label: { en: "Echo", zh: "回响" },
      patterns: [/(echo|reverb|reverberant)/],
    },
    {
      group: "low-end",
      label: { en: "Low hum", zh: "低鸣" },
      patterns: [/(hum|drone|rumble|vibrat|sub-bass|bass|low)/],
    },
    {
      group: "pulse",
      label: { en: "Pulse", zh: "脉冲" },
      patterns: [/(pulse|heartbeat|throb|pulsing)/],
    },
  ],
  music: [
    {
      group: "ambience",
      label: { en: "Dark ambient", zh: "暗色氛围" },
      patterns: [/(dark|ominous|oppressive|shadow|gloom)/, /(ambient|drone|atmospher)/],
    },
    {
      group: "ambience",
      label: { en: "Ambient", zh: "氛围" },
      patterns: [/(ambient|drone|atmospher)/],
    },
    {
      group: "low-end",
      label: { en: "Bass pulse", zh: "低频脉冲" },
      patterns: [/(sub-bass|bass|low-end|low-frequency|deep)/, /(pulse|heartbeat|throb|pulsing|beat)/],
    },
    {
      group: "rhythm",
      label: { en: "Drum rhythm", zh: "鼓点节奏" },
      patterns: [/(hand-drum|tribal|drum|percuss|rhythm|beat)/],
    },
    {
      group: "strings",
      label: { en: "Strings", zh: "弦乐" },
      patterns: [/(string|strings|violin|cello|orchestral)/],
    },
    {
      group: "piano",
      label: { en: "Piano", zh: "钢琴" },
      patterns: [/(piano|keys)/],
    },
    {
      group: "synth",
      label: { en: "Synth", zh: "合成器" },
      patterns: [/(synth|electronic|analog|neon)/],
    },
    {
      group: "chime",
      label: { en: "Bell tone", zh: "铃音" },
      patterns: [/(chime|bell|toll)/],
    },
    {
      group: "echo",
      label: { en: "Echo shimmer", zh: "回响微光" },
      patterns: [/(echo|reverb|delay|shimmer)/],
    },
    {
      group: "temperature",
      label: { en: "Cold texture", zh: "冷冽质感" },
      patterns: [/(cold|icy|frozen|glacial|stone-cold)/],
    },
    {
      group: "tension",
      label: { en: "Tension", zh: "紧张" },
      patterns: [/(tension|tense|suspense|threshold|unease)/],
    },
    {
      group: "mystery",
      label: { en: "Mystery", zh: "神秘" },
      patterns: [/(mystery|uncanny|eerie)/],
    },
    {
      group: "ethereal",
      label: { en: "Ethereal", zh: "空灵" },
      patterns: [/(wonder|ethereal|celestial|dreamy)/],
    },
  ],
};

function normalizeDescription(description: string) {
  return description
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFallbackTags(
  type: AudioLayerType,
  lang: InterfaceLang,
  mood?: MoodType,
) {
  const tags = [
    type === "music"
      ? (lang === "zh" ? "氛围" : "Ambient")
      : (lang === "zh" ? "环境" : "Texture"),
  ];

  if (mood) {
    tags.push(MOOD_MAP[mood].label[lang]);
  }

  return tags;
}

export function summarizeAudioLayerLabel({
  description,
  type,
  lang,
  mood,
}: {
  description?: string | null;
  type: AudioLayerType;
  lang: InterfaceLang;
  mood?: MoodType;
}) {
  const fallbackTypeLabel = t(type === "music" ? "player.music" : "player.sfx", lang);
  if (!description?.trim()) {
    return fallbackTypeLabel;
  }

  const normalized = normalizeDescription(description);
  const tags: string[] = [];
  const seenGroups = new Set<string>();

  for (const rule of KEYWORD_RULES[type]) {
    if (!rule.patterns.every((pattern) => pattern.test(normalized))) {
      continue;
    }

    if (rule.group && seenGroups.has(rule.group)) {
      continue;
    }

    const localizedLabel = rule.label[lang];
    if (!tags.includes(localizedLabel)) {
      tags.push(localizedLabel);
      if (rule.group) {
        seenGroups.add(rule.group);
      }
    }

    if (tags.length >= (type === "sfx" ? 2 : 3)) {
      break;
    }
  }

  if (tags.length === 0) {
    tags.push(...getFallbackTags(type, lang, mood));
  } else if (mood && tags.length < (type === "sfx" ? 2 : 3)) {
    const moodLabel = MOOD_MAP[mood].label[lang];
    if (!tags.includes(moodLabel)) {
      tags.push(moodLabel);
    }
  }

  return tags.join(" · ") || fallbackTypeLabel;
}
