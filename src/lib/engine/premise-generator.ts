import type { EchoSettings } from "@/lib/constants/defaults";
import { STORY_TAGS, type TagCategory } from "@/lib/constants/story-tags";
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

interface EmergencyPremiseContext {
  worldTagId?: string;
  moodTagId?: string;
  protagonistTagId?: string;
  customLabels: string[];
}

const PRESET_TAG_CATEGORY_BY_ID = new Map<string, TagCategory>(
  (Object.entries(STORY_TAGS) as Array<[TagCategory, (typeof STORY_TAGS)[TagCategory]]>).flatMap(
    ([category, group]) => group.options.map((option) => [option.id, category] as const),
  ),
);

const EN_EMERGENCY_SETTING_BY_ID: Partial<Record<string, string>> = {
  modern_city: "in a sleepless modern city",
  medieval: "inside a frontier fortress on the edge of a kingdom",
  space: "aboard a drifting space station",
  post_apocalyptic: "in a ruined settlement after the end of the world",
  victorian: "in a fog-bound Victorian district",
  east_asian_ancient: "in an ancient riverside town",
  underwater: "in an underwater colony below a silent sea",
  dreamscape: "inside a shifting dream-city",
  cyberpunk: "in a neon-soaked megacity",
  steampunk: "in a steam-powered capital",
  rural_pastoral: "in a quiet farming village",
  tropical_jungle: "at a research outpost deep in a tropical jungle",
  arctic: "at an isolated Arctic observatory",
  dungeon: "inside a sealed underground labyrinth",
};

const ZH_EMERGENCY_SETTING_BY_ID: Partial<Record<string, string>> = {
  modern_city: "一座不眠的现代都市",
  medieval: "王国边境的要塞",
  space: "一座漂流中的空间站",
  post_apocalyptic: "末日后的废墟聚落",
  victorian: "一片雾气弥漫的维多利亚街区",
  east_asian_ancient: "一座古老的临河小城",
  underwater: "沉在寂静海下的水下聚落",
  dreamscape: "不断变形的梦境之城",
  cyberpunk: "霓虹闪烁的巨型都市",
  steampunk: "蒸汽轰鸣的机械之都",
  rural_pastoral: "一座安静的乡村",
  tropical_jungle: "热带雨林深处的研究据点",
  arctic: "与世隔绝的极地观测站",
  dungeon: "被封死的地下迷宫",
};

const EN_EMERGENCY_PROTAGONIST_BY_ID: Partial<Record<string, string>> = {
  ordinary_person: "an ordinary person",
  detective: "a detective",
  scientist: "a scientist",
  warrior: "a weary warrior",
  child: "a curious child",
  elderly: "an older traveler",
  ai_robot: "an AI caretaker",
  animal: "an unusually clever animal",
  ghost: "a restless ghost",
  spy: "an undercover spy",
  musician: "a musician",
  wanderer: "a wanderer",
  alien: "a stranded alien",
};

const ZH_EMERGENCY_PROTAGONIST_BY_ID: Partial<Record<string, string>> = {
  ordinary_person: "普通人",
  detective: "侦探",
  scientist: "科学家",
  warrior: "疲惫的战士",
  child: "好奇的孩子",
  elderly: "上了年纪的旅人",
  ai_robot: "AI 看护者",
  animal: "异常聪明的动物",
  ghost: "不肯离开的幽灵",
  spy: "卧底间谍",
  musician: "音乐家",
  wanderer: "流浪者",
  alien: "滞留此地的外星来客",
};

const EN_EMERGENCY_GOAL_BY_MOOD_ID: Partial<Record<string, string>> = {
  horror: "to finish what should have been a routine assignment",
  suspense: "to solve a case before the last safe exit closes",
  passionate: "to prove they can survive the most dangerous challenge there",
  healing: "hoping this will be the quiet fresh start they needed",
  lonely: "searching for something they thought was gone forever",
  thrilling: "to solve a case before the last safe exit closes",
  melancholic: "searching for something they thought was gone forever",
  eerie: "to finish what should have been a routine assignment",
  cheerful: "hoping this will be the quiet fresh start they needed",
  meditative: "hoping this will be the quiet fresh start they needed",
};

const ZH_EMERGENCY_GOAL_BY_MOOD_ID: Partial<Record<string, string>> = {
  horror: "，原本只想完成一项例行任务",
  suspense: "，必须赶在最后一条安全退路关闭前解开一桩谜案",
  passionate: "，决心证明自己能撑过这里最危险的挑战",
  healing: "，希望在那里重新安静地开始",
  lonely: "，想找回自己以为早已失去的东西",
  thrilling: "，必须赶在最后一条安全退路关闭前解开一桩谜案",
  melancholic: "，想找回自己以为早已失去的东西",
  eerie: "，原本只想完成一项例行任务",
  cheerful: "，希望在那里重新安静地开始",
  meditative: "，希望在那里重新安静地开始",
};

const EN_EMERGENCY_HOOK_BY_MOOD_ID: Partial<Record<string, string>> = {
  horror:
    "After dark, the place starts answering every question with details from tomorrow, and the next warning is addressed to them by name.",
  suspense:
    "Before the next shift ends, they uncover a countdown tied to a disappearance that has not happened yet.",
  passionate:
    "Then they discover the challenge was designed to force one impossible choice, and someone else already expects them to fail it.",
  healing:
    "By evening, each small kindness reveals a secret someone has been hiding to protect the fragile peace there.",
  lonely:
    "Then a message arrives from the person they came to mourn, asking them not to leave yet.",
  thrilling:
    "Before the next shift ends, they uncover a countdown tied to a disappearance that has not happened yet.",
  melancholic:
    "Then a message arrives from the person they came to mourn, asking them not to leave yet.",
  eerie:
    "After dark, the place starts answering every question with details from tomorrow, and the next warning is addressed to them by name.",
  cheerful:
    "By evening, each small kindness reveals a secret someone has been hiding to protect the fragile peace there.",
  meditative:
    "By evening, each small kindness reveals a secret someone has been hiding to protect the fragile peace there.",
};

const ZH_EMERGENCY_HOOK_BY_MOOD_ID: Partial<Record<string, string>> = {
  horror: "天黑后，那里开始回答每一个问题，而且答案里总会提前泄露明天才会发生的事，下一次警告已经写上了这名来客的名字。",
  suspense: "下一轮封锁开始前，他发现一场尚未发生的失踪案已经进入倒计时。",
  passionate: "很快他就发现，这场挑战真正逼迫他的不是胜负，而是一次谁都承受不起的抉择。",
  healing: "到了傍晚，那里的每一份温柔都慢慢指向同一个被人小心藏起的秘密。",
  lonely: "随后，一条来自失去之人的讯息抵达眼前，只留下一个请求: 现在还不能离开。",
  thrilling: "下一轮封锁开始前，他发现一场尚未发生的失踪案已经进入倒计时。",
  melancholic: "随后，一条来自失去之人的讯息抵达眼前，只留下一个请求: 现在还不能离开。",
  eerie: "天黑后，那里开始回答每一个问题，而且答案里总会提前泄露明天才会发生的事，下一次警告已经写上了这名来客的名字。",
  cheerful: "到了傍晚，那里的每一份温柔都慢慢指向同一个被人小心藏起的秘密。",
  meditative: "到了傍晚，那里的每一份温柔都慢慢指向同一个被人小心藏起的秘密。",
};

function capitalizeSentence(raw: string) {
  if (!raw) {
    return raw;
  }

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function buildEmergencyPremiseContext(input: PremiseGenerationInput): EmergencyPremiseContext {
  const context: EmergencyPremiseContext = {
    customLabels: [],
  };

  for (const tag of input.selectedTags) {
    if (tag.isCustom) {
      context.customLabels.push(tag.label.trim());
      continue;
    }

    const category = PRESET_TAG_CATEGORY_BY_ID.get(tag.id);
    if (!category) {
      continue;
    }

    if (category === "world" && !context.worldTagId) {
      context.worldTagId = tag.id;
    }

    if (category === "mood" && !context.moodTagId) {
      context.moodTagId = tag.id;
    }

    if (category === "protagonist" && !context.protagonistTagId) {
      context.protagonistTagId = tag.id;
    }
  }

  return context;
}

function buildEnglishEmergencyPremise(context: EmergencyPremiseContext) {
  const setting =
    EN_EMERGENCY_SETTING_BY_ID[context.worldTagId ?? ""] ??
    "at a place that has just been sealed off from the outside world";
  const protagonist =
    EN_EMERGENCY_PROTAGONIST_BY_ID[context.protagonistTagId ?? ""] ?? "a reluctant outsider";
  const goal =
    EN_EMERGENCY_GOAL_BY_MOOD_ID[context.moodTagId ?? ""] ??
    "to solve the one problem everyone else has stopped naming";
  const firstSentence = capitalizeSentence(`${protagonist} arrives ${setting} ${goal}.`);

  if (context.customLabels.length >= 2) {
    return `${firstSentence} Every clue links "${context.customLabels[0]}" to "${context.customLabels[1]}", and the next warning is already addressed to them by name.`;
  }

  if (context.customLabels.length === 1) {
    return `${firstSentence} The first real clue points to something the locals only call "${context.customLabels[0]}", but everyone nearby swears it should not exist, and the next warning is already addressed to them by name.`;
  }

  return `${firstSentence} ${
    EN_EMERGENCY_HOOK_BY_MOOD_ID[context.moodTagId ?? ""] ??
    "Before dawn, they uncover evidence that the real danger started waiting for them long before they arrived."
  }`;
}

function buildChineseEmergencyPremise(context: EmergencyPremiseContext) {
  const setting =
    ZH_EMERGENCY_SETTING_BY_ID[context.worldTagId ?? ""] ?? "一处刚刚与外界隔绝的地方";
  const protagonist =
    ZH_EMERGENCY_PROTAGONIST_BY_ID[context.protagonistTagId ?? ""] ?? "不情愿的外来者";
  const goal =
    ZH_EMERGENCY_GOAL_BY_MOOD_ID[context.moodTagId ?? ""] ?? "，准备解决一件所有人都闭口不提的麻烦事";
  const firstSentence = `一名${protagonist}来到${setting}${goal}。`;

  if (context.customLabels.length >= 2) {
    return `${firstSentence} 所有线索最终都把“${context.customLabels[0]}”和“${context.customLabels[1]}”连到了一起，而下一次警告已经写上了这名来客的名字。`;
  }

  if (context.customLabels.length === 1) {
    return `${firstSentence} 第一条像样的线索只指向人们口中的“${context.customLabels[0]}”，可所有人都坚称那东西根本不该存在，而下一次警告已经写上了这名来客的名字。`;
  }

  return `${firstSentence}${
    ZH_EMERGENCY_HOOK_BY_MOOD_ID[context.moodTagId ?? ""] ??
    "天亮前，他发现真正的危险早在自己抵达之前就已经在那里等待。"
  }`;
}

function buildEmergencyPremise(input: PremiseGenerationInput) {
  const context = buildEmergencyPremiseContext(input);
  return input.language === "zh"
    ? buildChineseEmergencyPremise(context)
    : buildEnglishEmergencyPremise(context);
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

  return { premise: buildEmergencyPremise(input) };
}
