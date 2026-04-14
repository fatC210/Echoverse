import { extractJsonFromText } from "@/lib/utils/echoverse";

const INVALID_PREMISE_EXAMPLES = new Set([
  "...",
  "\u2026",
  "\u2026\u2026",
  "这里是一段可直接展示给用户的故事前提",
  "a direct user-facing story premise goes here.",
  "a direct user-facing story premise goes here",
]);

const PROMPT_LEAK_MARKERS = [
  "analysis request",
  "hard requirements",
  "output format",
  "selected tags",
  "tag list",
  "use these tags",
  "role:",
  "2 to 3 sentences",
  "immediately establish protagonist",
  "narrative hook",
  "return json only",
  "display-ready",
  "分析请求",
  "硬性要求",
  "输出格式",
  "标签",
  "只输出",
  "故事前提正文",
  "json 对象",
  "2 到 3 句话",
  "第一句",
  "叙事钩子",
  "可直接展示给用户",
];

const LEADING_META_PREFIX_PATTERNS = [
  /^(?:here(?:'s| is)\s+(?:your|the)?\s*(?:final\s+|direct\s+)?(?:story\s+)?premise\s*[:：]\s*)/i,
  /^(?:story\s+premise|premise|output|result|answer)\s*[:：]\s*/i,
  /^(?:以下(?:是一个|这是一段|这里是一段|请看)?\s*(?:一个)?(?:可直接展示给用户的)?(?:完整的)?(?:故事前提|前提|输出|结果|回答)\s*[:：]\s*)/u,
  /^\s*(?:[-*]\s+|\d+[.)]\s+)/,
] as const;

const INSTRUCTIONAL_SENTENCE_PATTERNS = [
  /analysis request/i,
  /hard requirements/i,
  /output format/i,
  /selected tags/i,
  /use these tags/i,
  /^tags?\s*[:：]/i,
  /2\s+to\s+3\s+sentences/i,
  /narrative hook/i,
  /write only/i,
  /return json only/i,
  /do not output anything except/i,
  /json object/i,
  /display-ready/i,
  /\bjson\b/i,
  /\brules?\b/i,
  /\binstructions?\b/i,
  /\brequirements?\b/i,
  /\*\*[^*]{1,40}\*\*\s*[:：]/,
  /分析请求/u,
  /硬性要求/u,
  /输出格式/u,
  /^标签\s*[:：]/u,
  /只输出/u,
  /不要输出.+以外/u,
  /故事前提正文/u,
  /json 对象/u,
  /2\s*到\s*3\s*句话/u,
  /第一句/u,
  /叙事钩子/u,
  /不要输出/u,
  /可直接展示给用户/u,
] as const;

const HOOK_HINT_PATTERNS = [
  /\?/u,
  /？/u,
  /\bbut\b/i,
  /\byet\b/i,
  /\bhowever\b/i,
  /\buntil\b/i,
  /\bbefore\b/i,
  /\bafter\b/i,
  /\bdiscovers?\b/i,
  /\brealizes?\b/i,
  /\bfinds?\b/i,
  /\bhears?\b/i,
  /\blearns?\b/i,
  /\bwarning\b/i,
  /\bsecret\b/i,
  /\bmissing\b/i,
  /\bvanish(?:es|ed)?\b/i,
  /\bunknown\b/i,
  /\bstrange\b/i,
  /\banomaly\b/i,
  /\bcountdown\b/i,
  /\bnot alone\b/i,
  /\bsomething else\b/i,
  /\bsomeone else\b/i,
  /\bshould not\b/i,
  /\bimpossible\b/i,
  /但/u,
  /却/u,
  /然而/u,
  /直到/u,
  /之前/u,
  /之后/u,
  /发现/u,
  /意识到/u,
  /听见/u,
  /听到/u,
  /看见/u,
  /警告/u,
  /秘密/u,
  /真相/u,
  /异常/u,
  /倒计时/u,
  /失踪/u,
  /未知/u,
  /似乎/u,
  /还有/u,
  /另一个/u,
  /不该/u,
  /不存在/u,
  /未发生/u,
  /求救/u,
  /危险/u,
  /诡异/u,
] as const;

const PREMISE_FIELD_KEYS = [
  "premise",
  "storyPremise",
  "story_premise",
  "premiseText",
  "premise_text",
  "text",
  "content",
  "response",
  "output",
  "result",
  "data",
  "message",
  "answer",
] as const;

const PREMISE_HINT_KEY_PATTERN = /(^|[_-])(premise|concept|hook)([_-]|$)/i;

interface PremiseCandidate {
  text: string;
  preferred: boolean;
}

function stripLeadingMetaPrefixes(raw: string) {
  let current = raw.trim();
  let changed = true;

  while (changed && current) {
    changed = false;

    for (const pattern of LEADING_META_PREFIX_PATTERNS) {
      const next = current.replace(pattern, "").trim();

      if (next !== current) {
        current = next;
        changed = true;
      }
    }
  }

  return current;
}

function splitIntoSentenceUnits(raw: string) {
  const matches = raw.match(/[^.!?。！？]+[.!?。！？]?/gu);

  return (matches ?? [raw]).map((part) => part.trim()).filter(Boolean);
}

function isInstructionalSentence(raw: string) {
  const normalized = stripLeadingMetaPrefixes(normalizeGeneratedPremise(raw));

  if (!normalized) {
    return true;
  }

  return INSTRUCTIONAL_SENTENCE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function hasNarrativeHook(raw: string) {
  return HOOK_HINT_PATTERNS.some((pattern) => pattern.test(raw));
}

function looksLikePromptLeak(raw: string) {
  const normalized = normalizeGeneratedPremise(raw);
  const source = `${raw}\n${normalized}`;
  const lowerSource = source.toLowerCase();
  const markerCount = PROMPT_LEAK_MARKERS.reduce(
    (count, marker) => count + (lowerSource.includes(marker.toLowerCase()) ? 1 : 0),
    0,
  );
  const hasListFormatting = /(^|\n)\s*(?:\d+[.)]\s+|\*+\s+|- )/m.test(raw);
  const hasMarkdownHeading = /\*\*[^*]{1,40}\*\*/.test(raw);
  const hasInstructionLabel =
    /(角色|role|硬性要求|hard requirements|输出格式|output format|标签|selected tags)\s*[:：]/iu.test(source);
  const startsWithMeta =
    /^(?:\d+[.)]\s*)?(?:\*\*)?(?:分析请求|analysis request|硬性要求|hard requirements|输出格式|output format)\b/iu.test(
      normalized,
    );

  return (
    startsWithMeta ||
    markerCount >= 2 ||
    (markerCount >= 1 && (hasInstructionLabel || hasListFormatting || hasMarkdownHeading))
  );
}

function stripWrappingCodeFence(raw: string) {
  const fencedMatch = raw.trim().match(/^```(?:[\w-]+)?\s*([\s\S]*?)\s*```$/u);
  return fencedMatch ? fencedMatch[1].trim() : raw;
}

export function normalizeGeneratedPremise(raw: string) {
  return stripWrappingCodeFence(raw)
    .replace(/[\r\n]+/g, " ")
    .replace(/^(story premise|premise|故事前提|前提)\s*[:：]\s*/iu, "")
    .replace(
      /^["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]+|["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]+$/gu,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function cleanGeneratedPremise(raw: string) {
  const normalized = stripLeadingMetaPrefixes(normalizeGeneratedPremise(raw));

  if (!normalized) {
    return "";
  }

  const sentenceUnits = splitIntoSentenceUnits(normalized);
  const narrativeUnits = sentenceUnits.filter((sentence) => !isInstructionalSentence(sentence));

  if (sentenceUnits.length > 0 && narrativeUnits.length === 0) {
    return "";
  }

  const candidate = (narrativeUnits.length > 0 ? narrativeUnits : sentenceUnits)
    .slice(0, 3)
    .join(" ")
    .trim();

  return stripLeadingMetaPrefixes(normalizeGeneratedPremise(candidate));
}

function dedupePremiseCandidates(candidates: PremiseCandidate[]) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    if (!candidate.text || seen.has(candidate.text)) {
      return false;
    }

    seen.add(candidate.text);
    return true;
  });
}

function tryReadJsonWrappedPremise(value: string, depth: number) {
  const trimmed = value.trim();

  if (depth > 4 || !/[{[]/.test(trimmed)) {
    return [];
  }

  try {
    return collectPremiseCandidates(extractJsonFromText<unknown>(trimmed), depth + 1, true);
  } catch {
    return [];
  }
}

function collectPremiseCandidates(
  value: unknown,
  depth = 0,
  preferred = false,
): PremiseCandidate[] {
  if (depth > 4 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    const normalized = cleanGeneratedPremise(value);
    const jsonWrappedCandidates = tryReadJsonWrappedPremise(value, depth);

    if (jsonWrappedCandidates.length > 0) {
      return jsonWrappedCandidates;
    }

    return normalized ? [{ text: normalized, preferred }] : [];
  }

  if (Array.isArray(value)) {
    return dedupePremiseCandidates(
      value.flatMap((item) => collectPremiseCandidates(item, depth + 1, preferred)),
    );
  }

  if (typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const candidates: PremiseCandidate[] = [];

  for (const key of PREMISE_FIELD_KEYS) {
    if (!(key in record)) {
      continue;
    }

    candidates.push(...collectPremiseCandidates(record[key], depth + 1, true));
  }

  for (const [key, entry] of Object.entries(record)) {
    if ((PREMISE_FIELD_KEYS as readonly string[]).includes(key)) {
      continue;
    }

    candidates.push(
      ...collectPremiseCandidates(entry, depth + 1, PREMISE_HINT_KEY_PATTERN.test(key)),
    );
  }

  return dedupePremiseCandidates(candidates);
}

function scorePremiseCandidate(candidate: PremiseCandidate) {
  const normalized = cleanGeneratedPremise(candidate.text);
  const semanticContent = normalized.replace(/[\s\p{P}\p{S}]/gu, "");
  const meaningfulBonus = isMeaningfulPremise(normalized) ? 1000 : 0;
  const preferredBonus = candidate.preferred ? 100 : 0;
  const sentenceCount = splitIntoSentenceUnits(normalized).length;
  const sentenceBonus = sentenceCount >= 2 && sentenceCount <= 3 ? 40 : 0;

  return meaningfulBonus + preferredBonus + sentenceBonus + semanticContent.length;
}

export function extractGeneratedPremise(value: unknown) {
  const candidates = collectPremiseCandidates(value);

  if (candidates.length === 0) {
    return "";
  }

  return [...candidates].sort(
    (left, right) => scorePremiseCandidate(right) - scorePremiseCandidate(left),
  )[0]?.text ?? "";
}

export function isMeaningfulPremise(raw: string) {
  const normalized = cleanGeneratedPremise(raw);

  if (!normalized) {
    return false;
  }

  if (INVALID_PREMISE_EXAMPLES.has(normalized.toLowerCase())) {
    return false;
  }

  if (
    looksLikePromptLeak(normalized) ||
    (looksLikePromptLeak(raw) && normalized === normalizeGeneratedPremise(raw))
  ) {
    return false;
  }

  if (/^[.\u2026\u00b7\u2022~\-_=\s]+$/u.test(normalized)) {
    return false;
  }

  const sentenceUnits = splitIntoSentenceUnits(normalized);

  if (sentenceUnits.length < 2 || sentenceUnits.length > 3) {
    return false;
  }

  if (sentenceUnits.some((sentence) => isInstructionalSentence(sentence))) {
    return false;
  }

  if (!hasNarrativeHook(normalized)) {
    return false;
  }

  const semanticContent = normalized.replace(/[\s\p{P}\p{S}]/gu, "");
  return semanticContent.length >= 12;
}

export function isPresentablePremise(raw: string) {
  const normalized = cleanGeneratedPremise(raw);

  if (!normalized) {
    return false;
  }

  if (INVALID_PREMISE_EXAMPLES.has(normalized.toLowerCase())) {
    return false;
  }

  if (
    looksLikePromptLeak(normalized) ||
    (looksLikePromptLeak(raw) && normalized === normalizeGeneratedPremise(raw))
  ) {
    return false;
  }

  if (/^[.\u2026\u00b7\u2022~\-_=\s]+$/u.test(normalized)) {
    return false;
  }

  const sentenceUnits = splitIntoSentenceUnits(normalized);

  if (sentenceUnits.length < 2 || sentenceUnits.length > 3) {
    return false;
  }

  if (sentenceUnits.some((sentence) => isInstructionalSentence(sentence))) {
    return false;
  }

  const semanticContent = normalized.replace(/[\s\p{P}\p{S}]/gu, "");
  return semanticContent.length >= 18;
}

export function isRecoverablePremise(raw: string) {
  const normalized = cleanGeneratedPremise(raw);

  if (!normalized) {
    return false;
  }

  if (INVALID_PREMISE_EXAMPLES.has(normalized.toLowerCase())) {
    return false;
  }

  if (
    looksLikePromptLeak(normalized) ||
    (looksLikePromptLeak(raw) && normalized === normalizeGeneratedPremise(raw))
  ) {
    return false;
  }

  if (/^[.\u2026\u00b7\u2022~\-_=\s]+$/u.test(normalized)) {
    return false;
  }

  const sentenceUnits = splitIntoSentenceUnits(normalized);

  if (sentenceUnits.some((sentence) => isInstructionalSentence(sentence))) {
    return false;
  }

  const semanticContent = normalized.replace(/[\s\p{P}\p{S}]/gu, "");
  return semanticContent.length >= 8;
}
