import type { Language } from "@/lib/types/echoverse";

export const STORY_TAGS = {
  world: {
    label: { en: "World Setting", zh: "世界设定" },
    icon: "world",
    options: [
      { id: "modern_city", label: { en: "Modern City", zh: "现代都市" } },
      { id: "medieval", label: { en: "Medieval", zh: "中世纪" } },
      { id: "space", label: { en: "Space", zh: "太空" } },
      { id: "post_apocalyptic", label: { en: "Post-Apocalyptic", zh: "末日废土" } },
      { id: "victorian", label: { en: "Victorian Era", zh: "维多利亚时代" } },
      { id: "east_asian_ancient", label: { en: "East Asian Ancient", zh: "东方古风" } },
      { id: "underwater", label: { en: "Underwater World", zh: "水下世界" } },
      { id: "dreamscape", label: { en: "Dreamscape / Surreal", zh: "梦境/超现实" } },
      { id: "cyberpunk", label: { en: "Cyberpunk", zh: "赛博朋克" } },
      { id: "steampunk", label: { en: "Steampunk", zh: "蒸汽朋克" } },
      { id: "rural_pastoral", label: { en: "Rural Pastoral", zh: "乡村田园" } },
      { id: "tropical_jungle", label: { en: "Tropical Jungle", zh: "热带丛林" } },
      { id: "arctic", label: { en: "Arctic", zh: "极地冰原" } },
      { id: "dungeon", label: { en: "Underground / Dungeon", zh: "地下城" } },
    ],
  },
  mood: {
    label: { en: "Emotional Tone", zh: "情绪色彩" },
    icon: "mood",
    options: [
      { id: "horror", label: { en: "Horror", zh: "恐怖" } },
      { id: "suspense", label: { en: "Suspense", zh: "悬疑" } },
      { id: "passionate", label: { en: "Passionate", zh: "热血" } },
      { id: "healing", label: { en: "Healing", zh: "治愈" } },
      { id: "lonely", label: { en: "Lonely", zh: "孤独" } },
      { id: "thrilling", label: { en: "Thrilling", zh: "紧张刺激" } },
      { id: "melancholic", label: { en: "Melancholic", zh: "忧伤" } },
      { id: "eerie", label: { en: "Eerie", zh: "诡异" } },
      { id: "cheerful", label: { en: "Cheerful", zh: "欢快" } },
      { id: "meditative", label: { en: "Meditative", zh: "平静冥想" } },
    ],
  },
  protagonist: {
    label: { en: "Protagonist", zh: "主角设定" },
    icon: "protagonist",
    options: [
      { id: "ordinary_person", label: { en: "Ordinary Person", zh: "普通人" } },
      { id: "detective", label: { en: "Detective", zh: "侦探" } },
      { id: "scientist", label: { en: "Scientist", zh: "科学家" } },
      { id: "warrior", label: { en: "Warrior", zh: "战士" } },
      { id: "child", label: { en: "Child", zh: "孩子" } },
      { id: "elderly", label: { en: "Elderly", zh: "老人" } },
      { id: "ai_robot", label: { en: "AI / Robot", zh: "AI/机器人" } },
      { id: "animal", label: { en: "Animal", zh: "动物" } },
      { id: "ghost", label: { en: "Ghost / Undead", zh: "幽灵/亡灵" } },
      { id: "spy", label: { en: "Spy", zh: "间谍" } },
      { id: "musician", label: { en: "Musician", zh: "音乐家" } },
      { id: "wanderer", label: { en: "Wanderer", zh: "流浪者" } },
      { id: "alien", label: { en: "Alien", zh: "外星人" } },
    ],
  },
} as const;

export type TagCategory = keyof typeof STORY_TAGS;
export type TagOption = (typeof STORY_TAGS)[TagCategory]["options"][number];

const STORY_TAG_OPTIONS = Object.values(STORY_TAGS).flatMap((category) => category.options);
const STORY_TAG_OPTION_BY_ID = new Map(STORY_TAG_OPTIONS.map((option) => [option.id, option] as const));

export function getStoryTagLabel(tagId: string, lang: Language) {
  return STORY_TAG_OPTION_BY_ID.get(tagId)?.label[lang] ?? tagId;
}

export function isPresetStoryTag(tagId: string) {
  return STORY_TAG_OPTION_BY_ID.has(tagId);
}
