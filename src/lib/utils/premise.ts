import { extractJsonFromText } from "@/lib/utils/echoverse";

const INVALID_PREMISE_EXAMPLES = new Set([
  "...",
  "\u2026",
  "\u2026\u2026",
  "\u8fd9\u91cc\u662f\u4e00\u6bb5\u53ef\u76f4\u63a5\u5c55\u793a\u7ed9\u7528\u6237\u7684\u6545\u4e8b\u524d\u63d0",
  "a direct user-facing story premise goes here.",
  "a direct user-facing story premise goes here",
]);

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

export function normalizeGeneratedPremise(raw: string) {
  return raw
    .replace(/[\r\n]+/g, " ")
    .replace(/^(story premise|premise|\u6545\u4e8b\u524d\u63d0|\u524d\u63d0)[\uff1a:]\s*/i, "")
    .replace(/^["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]+|["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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
    const normalized = normalizeGeneratedPremise(value);
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

    candidates.push(...collectPremiseCandidates(entry, depth + 1, PREMISE_HINT_KEY_PATTERN.test(key)));
  }

  return dedupePremiseCandidates(candidates);
}

function scorePremiseCandidate(candidate: PremiseCandidate) {
  const normalized = normalizeGeneratedPremise(candidate.text);
  const semanticContent = normalized.replace(/[\s\p{P}\p{S}]/gu, "");
  const meaningfulBonus = isMeaningfulPremise(normalized) ? 1000 : 0;
  const preferredBonus = candidate.preferred ? 100 : 0;
  const sentenceBonus = /[.!?。！？]/u.test(normalized) ? 20 : 0;

  return meaningfulBonus + preferredBonus + sentenceBonus + semanticContent.length;
}

export function extractGeneratedPremise(value: unknown) {
  const candidates = collectPremiseCandidates(value);

  if (candidates.length === 0) {
    return "";
  }

  return [...candidates]
    .sort((left, right) => scorePremiseCandidate(right) - scorePremiseCandidate(left))[0]
    ?.text ?? "";
}

export function isMeaningfulPremise(raw: string) {
  const normalized = normalizeGeneratedPremise(raw);

  if (!normalized) {
    return false;
  }

  if (INVALID_PREMISE_EXAMPLES.has(normalized.toLowerCase())) {
    return false;
  }

  if (/^[.\u2026\u00b7\u2022~\-_=\s]+$/u.test(normalized)) {
    return false;
  }

  const semanticContent = normalized.replace(/[\s\p{P}\p{S}]/gu, "");
  return semanticContent.length >= 8;
}
