export const DEFAULT_SETTINGS = {
  llm: {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o",
    embeddingModel: "text-embedding-3-small",
  },
  elevenlabs: {
    apiKey: "",
  },
  turbopuffer: {
    apiKey: "",
    baseUrl: "https://api.turbopuffer.com",
  },
  voice: {
    voiceId: "",
    voiceName: "",
    voiceDescription: "",
  },
  preferences: {
    interfaceLang: "en" as "en" | "zh",
    storyLang: "en" as "en" | "zh",
    audioQuality: "standard" as "standard" | "high",
  },
  customTags: [] as string[],
  onboardingCompleted: false,
};

export type EchoSettings = typeof DEFAULT_SETTINGS;

export const ELEVENLABS_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", description: { en: "Young, energetic", zh: "年轻、活力" } },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "female", description: { en: "Soft, friendly", zh: "柔和、友好" } },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", gender: "male", description: { en: "Calm, confident", zh: "沉稳、自信" } },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", gender: "male", description: { en: "Casual, natural", zh: "随性、自然" } },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male", description: { en: "Deep, authoritative", zh: "低沉、权威" } },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "female", description: { en: "Warm, expressive", zh: "温暖、富有表现力" } },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male", description: { en: "Clear, articulate", zh: "清晰、有条理" } },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "male", description: { en: "Warm, narrative", zh: "温暖、叙事感" } },
];

export const DURATION_OPTIONS = [
  { id: "short", chapters: 3, minutes: 5, label: { en: "Short (~5 min, 3 choices)", zh: "短篇（约 5 分钟，3 个选择点）" } },
  { id: "medium", chapters: 5, minutes: 15, label: { en: "Medium (~15 min, 5 choices)", zh: "中篇（约 15 分钟，5 个选择点）" } },
  { id: "long", chapters: 8, minutes: 30, label: { en: "Long (~30 min, 8 choices)", zh: "长篇（约 30 分钟，8 个选择点）" } },
] as const;
