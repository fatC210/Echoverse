import type { AudioAsset, Segment } from "@/lib/types/echoverse";

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
