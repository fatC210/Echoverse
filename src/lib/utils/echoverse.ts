export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function stripCodeFence(raw: string) {
  const fencedMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : raw;
}

function findBalancedJsonSlice(raw: string) {
  let start = -1;
  const stack: string[] = [];
  let inString = false;
  let escaping = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (start === -1) {
      if (char === "{" || char === "[") {
        start = index;
        stack.push(char === "{" ? "}" : "]");
      }
      continue;
    }

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      stack.push("}");
      continue;
    }

    if (char === "[") {
      stack.push("]");
      continue;
    }

    if ((char === "}" || char === "]") && stack[stack.length - 1] === char) {
      stack.pop();

      if (stack.length === 0) {
        return raw.slice(start, index + 1);
      }
    }
  }

  return null;
}

function parseJsonCandidate<T>(candidate: string): T {
  const parsed = JSON.parse(candidate) as unknown;

  if (typeof parsed === "string") {
    const nested = parsed.trim();

    if (nested.startsWith("{") || nested.startsWith("[")) {
      return parseJsonCandidate<T>(nested);
    }
  }

  return parsed as T;
}

function repairIncompleteJsonCandidate(candidate: string) {
  const trimmed = candidate.trim();

  if (!trimmed || !["{", "["].includes(trimmed[0])) {
    return null;
  }

  let result = trimmed.replace(/,\s*$/, "");
  const stack: string[] = [];
  let inString = false;
  let escaping = false;

  for (let index = 0; index < result.length; index += 1) {
    const char = result[index];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      stack.push("}");
      continue;
    }

    if (char === "[") {
      stack.push("]");
      continue;
    }

    if ((char === "}" || char === "]") && stack[stack.length - 1] === char) {
      stack.pop();
    }
  }

  if (escaping) {
    result = result.slice(0, -1);
  }

  if (inString) {
    result += "\"";
  }

  if (/[,:]\s*$/.test(result)) {
    return null;
  }

  const repaired = `${result}${stack.reverse().join("")}`;
  return repaired === trimmed ? null : repaired;
}

export function extractJsonResultFromText<T>(raw: string) {
  const trimmed = raw.trim().replace(/^\uFEFF/, "");

  if (!trimmed) {
    throw new Error("Empty response");
  }

  const stripped = stripCodeFence(trimmed);
  const candidates = new Map<string, boolean>();

  const addCandidate = (value: string | null, repaired = false) => {
    if (!value) {
      return;
    }

    const existing = candidates.get(value);

    if (existing === undefined || (existing && !repaired)) {
      candidates.set(value, repaired);
    }
  };

  addCandidate(trimmed);
  addCandidate(stripped);

  for (const value of [trimmed, stripped]) {
    const repaired = repairIncompleteJsonCandidate(value);

    addCandidate(repaired, true);
  }

  for (const value of [trimmed, stripped]) {
    const slice = findBalancedJsonSlice(value);

    addCandidate(slice);

    if (!slice) {
      const repairedSlice = repairIncompleteJsonCandidate(value);

      addCandidate(repairedSlice, true);
    }
  }

  for (const [candidate, repaired] of candidates.entries()) {
    try {
      return {
        value: parseJsonCandidate<T>(candidate),
        repaired,
      };
    } catch {
      // Try the next extraction strategy.
    }
  }

  throw new Error("Could not parse JSON from model response");
}

export function extractJsonFromText<T>(raw: string): T {
  return extractJsonResultFromText<T>(raw).value;
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || !right.length || left.length !== right.length) {
    return 0;
  }

  let dotProduct = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }

  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denominator ? dotProduct / denominator : 0;
}

export async function blobToAudioDuration(blob: Blob) {
  const url = URL.createObjectURL(blob);

  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.src = url;
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.onerror = () => reject(new Error("Unable to read audio metadata"));
    });

    return duration;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]+/g;
const LEADING_DOTS_AND_SPACES = /^[. ]+/g;
const TRAILING_DOTS_AND_SPACES = /[. ]+$/g;
const WINDOWS_RESERVED_FILENAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function removeControlCharacters(value: string) {
  return Array.from(value)
    .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    .join("");
}

function sanitizeFilenamePart(value: string) {
  return removeControlCharacters(value)
    .replace(INVALID_FILENAME_CHARS, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_DOTS_AND_SPACES, "")
    .replace(TRAILING_DOTS_AND_SPACES, "")
    .replace(/_+/g, "_");
}

export function sanitizeFilenameBase(value: string, fallback = "story") {
  const sanitizedValue = sanitizeFilenamePart(value);
  const sanitizedFallback = sanitizeFilenamePart(fallback) || "story";
  const candidate =
    sanitizedValue && sanitizedValue.replace(/_/g, "").length > 0
      ? sanitizedValue
      : sanitizedFallback;

  return WINDOWS_RESERVED_FILENAMES.test(candidate) ? `${candidate}_file` : candidate;
}

export function buildDownloadFilename(value: string, extension: string, fallback = "story") {
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  return `${sanitizeFilenameBase(value, fallback)}${normalizedExtension}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export async function blobToFloat32Array(blob: Blob) {
  const audioContext = new AudioContext();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channelData = decoded.getChannelData(0);
    return Float32Array.from(channelData);
  } finally {
    await audioContext.close();
  }
}
