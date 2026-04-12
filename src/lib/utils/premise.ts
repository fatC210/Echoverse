const INVALID_PREMISE_EXAMPLES = new Set([
  "...",
  "…",
  "……",
  "这里是一段可直接展示给用户的故事前提",
  "a direct user-facing story premise goes here.",
  "a direct user-facing story premise goes here",
]);

export function normalizeGeneratedPremise(raw: string) {
  return raw
    .replace(/[\r\n]+/g, " ")
    .replace(/^(story premise|premise|故事前提|前提)[：:]\s*/i, "")
    .replace(/^["“‘「『]+|["”’」』]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function isMeaningfulPremise(raw: string) {
  const normalized = normalizeGeneratedPremise(raw);

  if (!normalized) {
    return false;
  }

  if (INVALID_PREMISE_EXAMPLES.has(normalized.toLowerCase())) {
    return false;
  }

  if (/^[.…·•~\-_=\s]+$/u.test(normalized)) {
    return false;
  }

  const semanticContent = normalized.replace(/[\s\p{P}\p{S}]/gu, "");
  return semanticContent.length >= 8;
}
