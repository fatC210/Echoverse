import { ELEVENLABS_VOICES } from "@/lib/constants/defaults";
import type {
  NarrationCueRef,
  NarrationVoiceCue,
  WorldCharacter,
} from "@/lib/types/echoverse";

const SPEAKER_CARRYOVER_PATTERN = /^[\s"'`“”‘’「」,，。.!?！？;；:：\-—()（）[\]【】]*$/u;
const LATIN_NAME_PATTERN = "[A-Za-z][A-Za-z0-9_-]{1,31}";
const HAN_NAME_PATTERN = "\\p{Script=Han}{2,8}";
const SPEAKER_NAME_PATTERN = `(?:${LATIN_NAME_PATTERN}|${HAN_NAME_PATTERN})`;
const SPEECH_VERB_PATTERN = [
  "说",
  "问",
  "答",
  "回答",
  "低语",
  "低声",
  "轻声",
  "提醒",
  "警告",
  "插话",
  "开口",
  "回应",
  "表示",
  "命令",
  "喃喃道",
  "说道",
  "问道",
  "答道",
  "道",
  "said",
  "says",
  "asked",
  "asks",
  "replied",
  "replies",
  "whispered",
  "whispers",
  "murmured",
  "murmurs",
  "answered",
  "answers",
  "called",
  "calls",
  "warned",
  "warns",
  "added",
  "adds",
  "shouted",
  "shouts",
].join("|");

const PREFIX_SPEAKER_PATTERNS = [
  new RegExp(
    `(${SPEAKER_NAME_PATTERN})(?:的声音|的语气|的回答|的提醒|的警告|的命令)[^。！？!?\\n]{0,24}$`,
    "u",
  ),
  new RegExp(
    `(${SPEAKER_NAME_PATTERN})[^。！？!?\\n]{0,24}(?:${SPEECH_VERB_PATTERN})[^。！？!?\\n]{0,12}$`,
    "iu",
  ),
  new RegExp(`(${SPEAKER_NAME_PATTERN})\\s*[:：]\\s*$`, "u"),
];

const SUFFIX_SPEAKER_PATTERNS = [
  new RegExp(
    `^\\s*[,，]?\\s*(${SPEAKER_NAME_PATTERN})[^。！？!?\\n]{0,24}(?:${SPEECH_VERB_PATTERN})`,
    "iu",
  ),
];

const BUILT_IN_VOICE_IDS = ELEVENLABS_VOICES.map((voice) => voice.id);
const AI_LIKE_HINTS = [
  "ai",
  "assistant",
  "system",
  "protocol",
  "synthetic",
  "android",
  "robot",
  "logic",
  "precise",
  "机械",
  "系统",
  "理性",
  "精确",
  "算法",
  "合成",
];

const VOICE_ARCHETYPE_KEYWORDS: Record<string, string[]> = {
  EXAVITQu4vr4xnSDxMaL: [
    "young",
    "energetic",
    "bright",
    "curious",
    "spirited",
    "年轻",
    "活力",
    "灵动",
    "轻快",
  ],
  XrExE9yKIg1WjnnlVkGX: [
    "soft",
    "friendly",
    "gentle",
    "kind",
    "quiet",
    "柔和",
    "友好",
    "温柔",
    "安静",
  ],
  CwhRBWXzGAHq8TQ4Fs17: [
    "calm",
    "confident",
    "steady",
    "leader",
    "collected",
    "冷静",
    "自信",
    "沉稳",
    "镇定",
  ],
  IKne3meq5aSn9XLyUdCD: [
    "casual",
    "natural",
    "easygoing",
    "relaxed",
    "street",
    "随性",
    "自然",
    "轻松",
    "散漫",
  ],
  JBFqnCBsd6RMkjVDRZzb: [
    "deep",
    "low",
    "authoritative",
    "commanding",
    "serious",
    "cold",
    "低沉",
    "权威",
    "命令",
    "冷峻",
    "浑厚",
  ],
  pFZP5JQG7iQjIQuC4Bku: [
    "warm",
    "expressive",
    "emotional",
    "empathetic",
    "tender",
    "温暖",
    "富有表现力",
    "细腻",
    "感性",
  ],
  onwK4e9ZLuTAKqWW03F9: [
    "clear",
    "articulate",
    "precise",
    "formal",
    "clinical",
    "清晰",
    "条理",
    "克制",
    "理性",
    "精准",
  ],
  nPczCjzI2devNBz1zQrb: [
    "warm",
    "narrative",
    "thoughtful",
    "mature",
    "reflective",
    "温暖",
    "叙事",
    "沉思",
    "成熟",
  ],
};

const GENERIC_SPEAKER_STOPWORDS = new Set(
  [
    "她",
    "他",
    "它",
    "他们",
    "她们",
    "有人",
    "一个人",
    "一个声音",
    "声音",
    "系统",
    "engineer",
    "voice",
    "someone",
    "man",
    "woman",
  ].map((value) => value.toLowerCase()),
);

type DialogueCuePlan = Omit<NarrationCueRef, "assetId">;

interface NarrationVoicePlanInput {
  text: string;
  narratorVoiceId: string;
  protagonistName?: string;
  characters?: WorldCharacter[];
  scriptedCues?: NarrationVoiceCue[];
}

interface QuoteRange {
  openIndex: number;
  closeIndex: number;
}

const QUOTE_PAIRS = [
  { open: "\u201C", close: "\u201D" },
  { open: "\"", close: "\"" },
  { open: "\u300C", close: "\u300D" },
  { open: "\u2018", close: "\u2019" },
] as const;

function normalizeCueText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function normalizeSpeakerKey(value: string) {
  return value
    .trim()
    .replace(/^[`"'“”‘’「」]+|[`"'“”‘’「」,，。.!?！？;；:：]+$/gu, "")
    .toLowerCase();
}

function normalizeSpeakerName(value: string) {
  return value
    .trim()
    .replace(/(?:的声音|的语气|的回答|的提醒|的警告|的命令)$/u, "")
    .replace(/^[`"'“”‘’「」]+|[`"'“”‘’「」,，。.!?！？;；:：]+$/gu, "")
    .trim();
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function findNextQuoteRange(text: string, startIndex: number): QuoteRange | null {
  const quotePairs = [
    { open: "“", close: "”" },
    { open: "\"", close: "\"" },
    { open: "「", close: "」" },
    { open: "‘", close: "’" },
  ] as const;

  for (let index = startIndex; index < text.length; index += 1) {
    const pair = QUOTE_PAIRS.find((candidate) => text.startsWith(candidate.open, index));
    if (!pair) {
      continue;
    }

    const closeIndex = text.indexOf(pair.close, index + pair.open.length);
    if (closeIndex === -1) {
      continue;
    }

    return {
      openIndex: index,
      closeIndex,
    };
  }

  return null;
}

function canonicalizeSpeaker(
  speaker: string | undefined,
  knownSpeakers: Map<string, string>,
) {
  if (!speaker) {
    return undefined;
  }

  const normalizedName = normalizeSpeakerName(speaker);
  const normalizedKey = normalizeSpeakerKey(normalizedName);

  if (!normalizedKey || GENERIC_SPEAKER_STOPWORDS.has(normalizedKey)) {
    return undefined;
  }

  return knownSpeakers.get(normalizedKey) ?? normalizedName;
}

function extractSpeakerCandidate(
  text: string,
  patterns: RegExp[],
  knownSpeakers: Map<string, string>,
) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const speaker = canonicalizeSpeaker(match?.[1], knownSpeakers);
    if (speaker) {
      return speaker;
    }
  }

  return undefined;
}

function scoreVoiceForCharacter(character: WorldCharacter, voiceId: string) {
  const profileText = [
    character.name,
    character.role,
    character.personality,
    character.voice_description,
    character.relationship_to_protagonist,
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;

  for (const keyword of VOICE_ARCHETYPE_KEYWORDS[voiceId] ?? []) {
    if (profileText.includes(keyword)) {
      score += 3;
    }
  }

  if (voiceId === "onwK4e9ZLuTAKqWW03F9" && AI_LIKE_HINTS.some((hint) => profileText.includes(hint))) {
    score += 5;
  }

  if (voiceId === "JBFqnCBsd6RMkjVDRZzb" && /(guard|captain|commander|warden|command|警卫|舰长|命令)/iu.test(profileText)) {
    score += 4;
  }

  if (voiceId === "pFZP5JQG7iQjIQuC4Bku" && /(care|warm|kind|empathetic|温柔|安抚|共情)/iu.test(profileText)) {
    score += 4;
  }

  return score;
}

function getVoicePool(narratorVoiceId: string) {
  const filtered = BUILT_IN_VOICE_IDS.filter((voiceId) => voiceId !== narratorVoiceId);
  return filtered.length ? filtered : [...BUILT_IN_VOICE_IDS];
}

function pickVoiceIdForCharacter(
  character: WorldCharacter,
  narratorVoiceId: string,
  usedVoiceIds: Set<string>,
) {
  const voicePool = getVoicePool(narratorVoiceId);
  const seed = `${character.id}:${character.name}`;

  return [...voicePool]
    .sort((left, right) => {
      const scoreDifference =
        scoreVoiceForCharacter(character, right) - scoreVoiceForCharacter(character, left);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const usageDifference =
        Number(usedVoiceIds.has(left)) - Number(usedVoiceIds.has(right));
      if (usageDifference !== 0) {
        return usageDifference;
      }

      return (
        (hashString(`${seed}:${left}`) % 997) - (hashString(`${seed}:${right}`) % 997)
      );
    })[0];
}

function pickVoiceIdForUnknownSpeaker(name: string, narratorVoiceId: string) {
  const voicePool = getVoicePool(narratorVoiceId);
  const lowerName = name.toLowerCase();

  if (AI_LIKE_HINTS.some((hint) => lowerName.includes(hint))) {
    const aiPreferredVoices = [
      "onwK4e9ZLuTAKqWW03F9",
      "JBFqnCBsd6RMkjVDRZzb",
      "CwhRBWXzGAHq8TQ4Fs17",
    ];
    const preferred = aiPreferredVoices.find((voiceId) => voicePool.includes(voiceId));
    if (preferred) {
      return preferred;
    }
  }

  return voicePool[hashString(lowerName || name) % voicePool.length];
}

function createSpeakerVoiceLookup({
  narratorVoiceId,
  protagonistName,
  characters = [],
}: Omit<NarrationVoicePlanInput, "text">) {
  const knownSpeakers = new Map<string, string>();
  const speakerVoices = new Map<string, string>();
  const usedVoiceIds = new Set<string>();

  if (protagonistName?.trim()) {
    const normalizedKey = normalizeSpeakerKey(protagonistName);
    knownSpeakers.set(normalizedKey, protagonistName.trim());
    speakerVoices.set(normalizedKey, narratorVoiceId);
  }

  for (const character of [...characters].sort((left, right) => left.id.localeCompare(right.id))) {
    const normalizedName = character.name.trim();
    if (!normalizedName) {
      continue;
    }

    const voiceId = pickVoiceIdForCharacter(character, narratorVoiceId, usedVoiceIds);
    const normalizedKey = normalizeSpeakerKey(normalizedName);
    knownSpeakers.set(normalizedKey, normalizedName);
    speakerVoices.set(normalizedKey, voiceId);
    usedVoiceIds.add(voiceId);
  }

  return {
    knownSpeakers,
    speakerVoices,
  };
}

function resolveDialogueSpeaker(
  text: string,
  quoteRange: QuoteRange,
  knownSpeakers: Map<string, string>,
  carryoverSpeaker?: string,
) {
  const prefix = text.slice(Math.max(0, quoteRange.openIndex - 96), quoteRange.openIndex);
  const suffix = text.slice(quoteRange.closeIndex + 1, quoteRange.closeIndex + 72);

  return (
    extractSpeakerCandidate(prefix, PREFIX_SPEAKER_PATTERNS, knownSpeakers) ??
    extractSpeakerCandidate(suffix, SUFFIX_SPEAKER_PATTERNS, knownSpeakers) ??
    carryoverSpeaker
  );
}

function pushCue(cues: DialogueCuePlan[], cue: DialogueCuePlan) {
  const normalizedText = normalizeCueText(cue.text);
  if (!normalizedText) {
    return;
  }

  const previousCue = cues[cues.length - 1];
  if (
    previousCue &&
    previousCue.kind === cue.kind &&
    previousCue.voiceId === cue.voiceId &&
    previousCue.speaker === cue.speaker
  ) {
    previousCue.text = `${previousCue.text} ${normalizedText}`.trim();
    return;
  }

  cues.push({
    ...cue,
    text: normalizedText,
  });
}

function buildDialogueCueFromSpeaker(
  speaker: string | undefined,
  narratorVoiceId: string,
  speakerVoices: Map<string, string>,
  unknownSpeakerVoices: Map<string, string>,
) {
  const normalizedSpeakerKey = speaker ? normalizeSpeakerKey(speaker) : undefined;
  const voiceId =
    (normalizedSpeakerKey ? speakerVoices.get(normalizedSpeakerKey) : undefined) ??
    (normalizedSpeakerKey
      ? unknownSpeakerVoices.get(normalizedSpeakerKey)
      : undefined) ??
    (speaker ? pickVoiceIdForUnknownSpeaker(speaker, narratorVoiceId) : narratorVoiceId);

  if (speaker && normalizedSpeakerKey && !speakerVoices.has(normalizedSpeakerKey)) {
    unknownSpeakerVoices.set(normalizedSpeakerKey, voiceId);
  }

  return {
    speaker,
    voiceId,
  };
}

function buildCuesFromStructuredPlan(
  scriptedCues: NarrationVoiceCue[],
  narratorVoiceId: string,
  knownSpeakers: Map<string, string>,
  speakerVoices: Map<string, string>,
) {
  const cues: DialogueCuePlan[] = [];
  const unknownSpeakerVoices = new Map<string, string>();

  for (const scriptedCue of scriptedCues) {
    const normalizedText = normalizeCueText(scriptedCue.text);
    if (!normalizedText) {
      continue;
    }

    const normalizedSpeaker =
      scriptedCue.kind === "dialogue"
        ? canonicalizeSpeaker(scriptedCue.speaker ?? undefined, knownSpeakers)
        : undefined;

    if (scriptedCue.kind === "dialogue") {
      const dialogueVoice = buildDialogueCueFromSpeaker(
        normalizedSpeaker,
        narratorVoiceId,
        speakerVoices,
        unknownSpeakerVoices,
      );

      pushCue(cues, {
        kind: "dialogue",
        text: normalizedText,
        speaker: dialogueVoice.speaker,
        voiceId: dialogueVoice.voiceId,
      });
    } else {
      pushCue(cues, {
        kind: "narration",
        text: normalizedText,
        voiceId: narratorVoiceId,
      });
    }
  }

  return cues;
}

function buildAnchoredCuesFromStructuredPlan(
  text: string,
  scriptedCues: NarrationVoiceCue[],
  narratorVoiceId: string,
  knownSpeakers: Map<string, string>,
  speakerVoices: Map<string, string>,
) {
  const cues: DialogueCuePlan[] = [];
  const unknownSpeakerVoices = new Map<string, string>();
  let cursor = 0;
  let matchedCueCount = 0;

  for (const scriptedCue of scriptedCues) {
    const cueText = scriptedCue.text.trim();
    const normalizedText = normalizeCueText(cueText);
    if (!normalizedText) {
      continue;
    }

    const exactMatchIndex = text.indexOf(cueText, cursor);
    const normalizedMatchIndex =
      exactMatchIndex === -1 && cueText !== normalizedText
        ? text.indexOf(normalizedText, cursor)
        : exactMatchIndex;
    const matchText =
      normalizedMatchIndex === exactMatchIndex ? cueText : normalizedText;

    if (normalizedMatchIndex === -1) {
      return buildCuesFromStructuredPlan(
        scriptedCues,
        narratorVoiceId,
        knownSpeakers,
        speakerVoices,
      );
    }

    let cueStartIndex = normalizedMatchIndex;
    let cueEndIndex = normalizedMatchIndex + matchText.length;

    if (scriptedCue.kind === "dialogue") {
      const quotePair = QUOTE_PAIRS.find(
        (pair) =>
          cueStartIndex >= pair.open.length &&
          text.slice(cueStartIndex - pair.open.length, cueStartIndex) === pair.open &&
          text.slice(cueEndIndex, cueEndIndex + pair.close.length) === pair.close,
      );

      if (quotePair) {
        cueStartIndex -= quotePair.open.length;
        cueEndIndex += quotePair.close.length;
      }
    }

    pushCue(cues, {
      kind: "narration",
      text: text.slice(cursor, cueStartIndex),
      voiceId: narratorVoiceId,
    });

    const normalizedSpeaker =
      scriptedCue.kind === "dialogue"
        ? canonicalizeSpeaker(scriptedCue.speaker ?? undefined, knownSpeakers)
        : undefined;

    if (scriptedCue.kind === "dialogue") {
      const dialogueVoice = buildDialogueCueFromSpeaker(
        normalizedSpeaker,
        narratorVoiceId,
        speakerVoices,
        unknownSpeakerVoices,
      );

      pushCue(cues, {
        kind: "dialogue",
        text: text.slice(normalizedMatchIndex, normalizedMatchIndex + matchText.length),
        speaker: dialogueVoice.speaker,
        voiceId: dialogueVoice.voiceId,
      });
    } else {
      pushCue(cues, {
        kind: "narration",
        text: text.slice(normalizedMatchIndex, normalizedMatchIndex + matchText.length),
        voiceId: narratorVoiceId,
      });
    }

    cursor = cueEndIndex;
    matchedCueCount += 1;
  }

  if (!matchedCueCount) {
    return buildCuesFromStructuredPlan(
      scriptedCues,
      narratorVoiceId,
      knownSpeakers,
      speakerVoices,
    );
  }

  pushCue(cues, {
    kind: "narration",
    text: text.slice(cursor),
    voiceId: narratorVoiceId,
  });

  return cues;
}

export function planNarrationCues({
  text,
  narratorVoiceId,
  protagonistName,
  characters = [],
  scriptedCues = [],
}: NarrationVoicePlanInput): DialogueCuePlan[] {
  const normalizedNarration = normalizeCueText(text);
  if (!normalizedNarration) {
    return [];
  }

  const { knownSpeakers, speakerVoices } = createSpeakerVoiceLookup({
    narratorVoiceId,
    protagonistName,
    characters,
  });

  if (scriptedCues.length) {
    const structuredCues = buildAnchoredCuesFromStructuredPlan(
      text,
      scriptedCues,
      narratorVoiceId,
      knownSpeakers,
      speakerVoices,
    );

    if (structuredCues.length) {
      return structuredCues;
    }
  }

  const cues: DialogueCuePlan[] = [];
  const unknownSpeakerVoices = new Map<string, string>();
  let cursor = 0;
  let lastDialogueSpeaker: string | undefined;

  while (true) {
    const quoteRange = findNextQuoteRange(text, cursor);
    if (!quoteRange) {
      break;
    }

    const leadingText = text.slice(cursor, quoteRange.openIndex);
    pushCue(cues, {
      text: leadingText,
      kind: "narration",
      voiceId: narratorVoiceId,
    });

    const carryoverSpeaker =
      lastDialogueSpeaker && SPEAKER_CARRYOVER_PATTERN.test(leadingText)
        ? lastDialogueSpeaker
        : undefined;
    const dialogueSpeaker = resolveDialogueSpeaker(
      text,
      quoteRange,
      knownSpeakers,
      carryoverSpeaker,
    );
    const dialogueVoice = buildDialogueCueFromSpeaker(
      dialogueSpeaker,
      narratorVoiceId,
      speakerVoices,
      unknownSpeakerVoices,
    );

    pushCue(cues, {
      text: text.slice(quoteRange.openIndex + 1, quoteRange.closeIndex),
      kind: "dialogue",
      speaker: dialogueVoice.speaker,
      voiceId: dialogueVoice.voiceId,
    });

    lastDialogueSpeaker = dialogueSpeaker;
    cursor = quoteRange.closeIndex + 1;
  }

  pushCue(cues, {
    text: text.slice(cursor),
    kind: "narration",
    voiceId: narratorVoiceId,
  });

  return cues.length
    ? cues
    : [
        {
          text: normalizedNarration,
          kind: "narration",
          voiceId: narratorVoiceId,
        },
      ];
}
