import type { EchoSettings } from "@/lib/constants/defaults";
import type { Language } from "@/lib/types/echoverse";
import { generateLlmText, generateStructuredJson } from "@/lib/services/llm";
import {
  cleanGeneratedPremise,
  extractGeneratedPremise,
  isRecoverablePremise,
  isMeaningfulPremise,
  isPresentablePremise,
} from "@/lib/utils/premise";

type LlmSettings = EchoSettings["llm"];

export interface PremiseGenerationTag {
  id: string;
  label: string;
  isCustom: boolean;
}

export interface PremiseGenerationInput {
  language: Language;
  selectedTags: PremiseGenerationTag[];
}

export interface PremiseGenerationResult {
  premise: string;
}

interface PremiseSuggestion {
  premise?: unknown;
  storyPremise?: unknown;
  story_premise?: unknown;
  premiseText?: unknown;
  premise_text?: unknown;
  text?: unknown;
  content?: unknown;
  response?: unknown;
  output?: unknown;
  result?: unknown;
  data?: unknown;
  message?: unknown;
  answer?: unknown;
}

type PremiseAcceptanceLevel = "strict" | "acceptable" | "fallback";

interface PremiseCandidateEvaluation {
  premise: string;
  level: PremiseAcceptanceLevel;
}

function formatTagList(tags: PremiseGenerationTag[], language: Language) {
  return tags
    .map((tag) => `${tag.label}${tag.isCustom ? (language === "zh" ? "（自定义）" : " (custom)") : ""}`)
    .join(", ");
}

function buildSystemPrompt(language: Language, hasTags: boolean) {
  if (language === "zh") {
    return `你是 Echoverse 的故事前提写作者。你只输出一个 JSON 对象，格式固定为 {"premise":"..."}。

硬性要求：
- premise 字段里只能写可直接展示给用户看的故事前提正文
- 必须写成 2 到 3 句话
- 第一句必须建立主角、当前处境或明确目标
- 后续句子必须留下未解决的叙事钩子，例如异常、秘密、危险、倒计时、失踪、未知存在、矛盾或警告
- 必须给后续剧情发展留下空间
- ${hasTags ? "有标签时，必须用标签来构建故事前提，让标签体现在设定、主角、冲突、氛围或悬念里；不要把标签名直接列表写进结果" : "没有标签时，必须自行随机决定题材、氛围、主角身份和核心冲突，并给出新鲜组合"}
- 不要输出标题、分析、说明、标签列表、Markdown，或 JSON 以外的任何文字`;
  }

  return `You are Echoverse's story-premise writer. Return exactly one JSON object in the form {"premise":"..."}.

Hard requirements:
- The premise field must contain only a player-facing story premise
- Write exactly 2 to 3 sentences
- The first sentence must establish the protagonist and their immediate situation or goal
- The later sentence or sentences must introduce an unresolved hook such as danger, anomaly, secrecy, a countdown, a disappearance, an unknown presence, a contradiction, or a warning
- Leave clear room for later story development
- ${hasTags ? "When tags are provided, use them to build the premise so they shape the setting, protagonist, conflict, mood, or suspense; do not list the tag names in the result" : "When no tags are provided, randomly invent the genre, atmosphere, protagonist identity, and central conflict yourself, and keep the combination fresh"}
- Do not output a title, analysis, commentary, tag list, markdown, or any text outside the JSON object`;
}

function buildAttemptPrompt(input: PremiseGenerationInput, isRetry: boolean) {
  const tagList = formatTagList(input.selectedTags, input.language);

  if (input.language === "zh") {
    if (input.selectedTags.length > 0) {
      return isRetry
        ? `上一个结果虽然是可解析的 JSON，但里面的故事前提还不够像可直接展示给用户的成品。请重新输出一个 JSON 对象，并继续认真使用这些标签来构建故事前提：${tagList}。如果其中有自定义标签，请把它们当作真实创意约束自然融入前提，不要解释标签。`
        : `请输出一个 JSON 对象，并使用这些标签来构建故事前提：${tagList}。如果其中有自定义标签，请把它们当作真实创意约束自然融入前提，不要只把标签当成表面装饰。`;
    }

    return isRetry
      ? "上一个结果虽然是可解析的 JSON，但里面的故事前提还不够像可直接展示给用户的成品。请重新随机生成一个原创故事前提，并且只输出 JSON 对象。"
      : "用户没有选择任何标签。请随机生成一个原创故事前提，并且只输出 JSON 对象。";
  }

  if (input.selectedTags.length > 0) {
    return isRetry
      ? `The previous result was parseable JSON, but the premise was still not display-ready. Return a new JSON object and keep using these tags to build the story premise: ${tagList}. Treat custom tags as real creative constraints and weave them in naturally without explaining the tags.`
      : `Return one JSON object and use these tags to build the story premise: ${tagList}. If any tag is custom, treat it as a real creative constraint and integrate it naturally instead of using it as decoration.`;
  }

  return isRetry
    ? "The previous result was parseable JSON, but the premise was still not display-ready. Randomly generate a fresh original story premise and return JSON only."
    : "The user selected no tags. Randomly generate one original story premise and return JSON only.";
}

function buildFallbackPrompt(input: PremiseGenerationInput) {
  const tagList = formatTagList(input.selectedTags, input.language);

  if (input.language === "zh") {
    return input.selectedTags.length > 0
      ? `忽略之前的格式问题，重新直接写一段可展示给用户的故事前提正文。只输出故事前提本身，不要 JSON、标题、说明、标签列表或 Markdown。请继续自然融入这些标签：${tagList}。`
      : "忽略之前的格式问题，重新随机写一段可展示给用户的原创故事前提正文。只输出故事前提本身，不要 JSON、标题、说明、标签列表或 Markdown。";
  }

  return input.selectedTags.length > 0
    ? `Ignore the earlier formatting issues and write one user-facing story premise directly. Output only the premise itself, with no JSON, title, commentary, tag list, or markdown. Keep naturally using these tags: ${tagList}.`
    : "Ignore the earlier formatting issues and write one original user-facing story premise directly. Output only the premise itself, with no JSON, title, commentary, tag list, or markdown.";
}

function evaluatePremiseCandidate(value: unknown): PremiseCandidateEvaluation | null {
  const premise = cleanGeneratedPremise(extractGeneratedPremise(value));

  if (!premise) {
    return null;
  }

  if (isMeaningfulPremise(premise)) {
    return { premise, level: "strict" };
  }

  if (isPresentablePremise(premise)) {
    return { premise, level: "acceptable" };
  }

  if (isRecoverablePremise(premise)) {
    return { premise, level: "fallback" };
  }

  return null;
}

function scorePremiseCandidate(candidate: PremiseCandidateEvaluation) {
  const levelScore = {
    strict: 3,
    acceptable: 2,
    fallback: 1,
  } satisfies Record<PremiseAcceptanceLevel, number>;
  const semanticLength = candidate.premise.replace(/[\s\p{P}\p{S}]/gu, "").length;

  return levelScore[candidate.level] * 1000 + semanticLength;
}

function pickBetterCandidate(
  current: PremiseCandidateEvaluation | null,
  next: PremiseCandidateEvaluation | null,
) {
  if (!next) {
    return current;
  }

  if (!current) {
    return next;
  }

  return scorePremiseCandidate(next) > scorePremiseCandidate(current) ? next : current;
}

function shouldAttemptTextFallback(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /could not parse json|empty response|llm response was empty/i.test(error.message);
}

export async function generateStoryPremise(
  settings: LlmSettings,
  input: PremiseGenerationInput,
): Promise<PremiseGenerationResult> {
  const hasTags = input.selectedTags.length > 0;
  const systemPrompt = buildSystemPrompt(input.language, hasTags);
  let bestCandidate: PremiseCandidateEvaluation | null = null;
  let lastCandidate = "";
  const attempts = [
    {
      prompt: buildAttemptPrompt(input, false),
      temperature: hasTags ? 0.85 : 1,
    },
    {
      prompt: buildAttemptPrompt(input, true),
      temperature: hasTags ? 0.65 : 0.75,
    },
  ];

  for (const attempt of attempts) {
    let result: PremiseSuggestion;

    try {
      result = await generateStructuredJson<PremiseSuggestion>(
        settings,
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: attempt.prompt },
        ],
        {
          max_tokens: 260,
          temperature: attempt.temperature,
        },
      );
    } catch (error) {
      if (!shouldAttemptTextFallback(error)) {
        throw error;
      }

      continue;
    }

    const candidate = evaluatePremiseCandidate(result);

    if (candidate) {
      lastCandidate = candidate.premise;
      bestCandidate = pickBetterCandidate(bestCandidate, candidate);

      if (candidate.level !== "fallback") {
        return { premise: candidate.premise };
      }
      continue;
    }

    const premise = cleanGeneratedPremise(extractGeneratedPremise(result));
    if (premise) {
      lastCandidate = premise;
    }
  }

  const fallbackText = await generateLlmText(
    settings,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildFallbackPrompt(input) },
    ],
    {
      max_tokens: 260,
      temperature: hasTags ? 0.55 : 0.7,
    },
  );

  const fallbackCandidate = evaluatePremiseCandidate(fallbackText);

  if (fallbackCandidate) {
    return { premise: pickBetterCandidate(bestCandidate, fallbackCandidate)?.premise ?? fallbackCandidate.premise };
  }

  const cleanedFallback = cleanGeneratedPremise(extractGeneratedPremise(fallbackText));
  if (cleanedFallback) {
    lastCandidate = cleanedFallback;
  }

  if (bestCandidate) {
    return { premise: bestCandidate.premise };
  }

  const snippet = lastCandidate.replace(/\s+/g, " ").trim().slice(0, 160);
  throw new Error(snippet ? `Premise was invalid: ${snippet}` : "Premise was invalid");
}
