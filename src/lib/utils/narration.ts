import type { AudioAsset, Segment } from "@/lib/types/echoverse";

const SENTENCE_PAUSE_RE = /[.!?。！？…]/u;
const CLAUSE_PAUSE_RE = /[,;:，；：、]/u;
const LATIN_WORD_CHAR_RE = /[\p{Script=Latin}\p{N}]/u;
const CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function splitWhitespaceSeparatedNarration(text: string) {
  return text.match(/\S+\s*/gu) ?? [];
}

function splitCjkNarration(text: string) {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter === "undefined") {
    return Array.from(text);
  }

  const segments = Array.from(
    new Intl.Segmenter(undefined, { granularity: "word" }).segment(text),
  )
    .map((segment) => segment.segment)
    .filter((segment) => segment.trim().length > 0);

  if (segments.length > 1) {
    return segments;
  }

  return Array.from(text);
}

export function splitNarrationForReveal(text: string) {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  if (/\s/u.test(normalized)) {
    return splitWhitespaceSeparatedNarration(normalized);
  }

  return splitCjkNarration(normalized);
}

export function estimateNarrationChunkWeight(chunk: string) {
  const normalized = chunk.replace(/\s+/gu, "");

  if (!normalized) {
    return 0.4;
  }

  let weight = 0;

  for (const char of Array.from(normalized)) {
    if (CJK_CHAR_RE.test(char)) {
      weight += 0.95;
      continue;
    }

    if (LATIN_WORD_CHAR_RE.test(char)) {
      weight += 0.32;
      continue;
    }

    weight += 0.12;
  }

  if (SENTENCE_PAUSE_RE.test(normalized)) {
    weight += 1.8;
  } else if (CLAUSE_PAUSE_RE.test(normalized)) {
    weight += 0.85;
  }

  return Math.max(weight, 0.6);
}

export function buildNarrationRevealThresholds(chunks: string[]) {
  if (!chunks.length) {
    return [];
  }

  const weights = chunks.map((chunk) => estimateNarrationChunkWeight(chunk));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let accumulatedWeight = 0;

  return weights.map((weight) => {
    accumulatedWeight += weight;
    return accumulatedWeight / totalWeight;
  });
}

export function getVisibleNarrationChunkCount(
  thresholds: number[],
  progress: number,
) {
  if (!thresholds.length) {
    return 0;
  }

  if (progress <= 0) {
    return 0;
  }

  if (progress >= 1) {
    return thresholds.length;
  }

  for (let index = 0; index < thresholds.length; index += 1) {
    if (progress <= thresholds[index]) {
      return index + 1;
    }
  }

  return thresholds.length;
}

export function getNarrationAssetIds(segment: Pick<Segment, "resolvedAudio">) {
  const cueAssetIds =
    segment.resolvedAudio?.narrationCues
      ?.map((cue) => cue.assetId)
      .filter((assetId) => Boolean(assetId)) ?? [];

  if (cueAssetIds.length) {
    return cueAssetIds;
  }

  return segment.resolvedAudio?.narrationAssetId
    ? [segment.resolvedAudio.narrationAssetId]
    : [];
}

export function getNarrationDurationSec(
  segment: Pick<Segment, "resolvedAudio">,
  assets: Record<string, AudioAsset>,
) {
  return getNarrationAssetIds(segment).reduce(
    (totalDuration, assetId) => totalDuration + (assets[assetId]?.durationSec ?? 0),
    0,
  );
}
