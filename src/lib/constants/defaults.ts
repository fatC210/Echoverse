export const DEFAULT_LLM_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_LLM_MODEL = "gpt-4o";
export const DEFAULT_LLM_EMBEDDING_MODEL = "text-embedding-3-small";

export const DEFAULT_SETTINGS = {
  llm: {
    baseUrl: "",
    apiKey: "",
    model: "",
    embeddingModel: DEFAULT_LLM_EMBEDDING_MODEL,
    verifiedConfigSignature: "",
  },
  elevenlabs: {
    apiKey: "",
    verifiedApiKey: "",
  },
  turbopuffer: {
    apiKey: "",
    baseUrl: "https://api.turbopuffer.com",
    verifiedConfigSignature: "",
  },
  voice: {
    voiceId: "",
    voiceName: "",
    voiceDescription: "",
  },
  preferences: {
    interfaceLang: "en" as "en" | "zh",
    storyLang: "en" as "en" | "zh",
  },
  customTags: [] as string[],
  onboardingCompleted: false,
};

export type EchoSettings = typeof DEFAULT_SETTINGS;

export function resolveLlmSettings(
  llm: EchoSettings["llm"],
): EchoSettings["llm"] {
  return {
    ...llm,
    baseUrl: llm.baseUrl.trim() || DEFAULT_LLM_BASE_URL,
    model: llm.model.trim() || DEFAULT_LLM_MODEL,
    embeddingModel:
      llm.embeddingModel.trim() || DEFAULT_LLM_EMBEDDING_MODEL,
  };
}

export const ELEVENLABS_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: { en: "Sarah", zh: "莎拉" }, gender: "female", description: { en: "Young, energetic", zh: "年轻、活力" } },
  { id: "XrExE9yKIg1WjnnlVkGX", name: { en: "Matilda", zh: "玛蒂尔达" }, gender: "female", description: { en: "Soft, friendly", zh: "柔和、友好" } },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: { en: "Roger", zh: "罗杰" }, gender: "male", description: { en: "Calm, confident", zh: "沉稳、自信" } },
  { id: "IKne3meq5aSn9XLyUdCD", name: { en: "Charlie", zh: "查理" }, gender: "male", description: { en: "Casual, natural", zh: "随性、自然" } },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: { en: "George", zh: "乔治" }, gender: "male", description: { en: "Deep, authoritative", zh: "低沉、权威" } },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: { en: "Lily", zh: "莉莉" }, gender: "female", description: { en: "Warm, expressive", zh: "温暖、富有表现力" } },
  { id: "onwK4e9ZLuTAKqWW03F9", name: { en: "Daniel", zh: "丹尼尔" }, gender: "male", description: { en: "Clear, articulate", zh: "清晰、有条理" } },
  { id: "nPczCjzI2devNBz1zQrb", name: { en: "Brian", zh: "布莱恩" }, gender: "male", description: { en: "Warm, narrative", zh: "温暖、叙事感" } },
];

export const DURATION_OPTIONS = [
  { id: "short", chapters: 3, minutes: 5, label: { en: "Short (~5 min, 3 choices)", zh: "短篇（约 5 分钟，3 个选择点）" } },
  { id: "medium", chapters: 5, minutes: 15, label: { en: "Medium (~15 min, 5 choices)", zh: "中篇（约 15 分钟，5 个选择点）" } },
  { id: "long", chapters: 8, minutes: 30, label: { en: "Long (~30 min, 8 choices)", zh: "长篇（约 30 分钟，8 个选择点）" } },
] as const;
