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

const PRESET_TAG_MATCH_PATTERNS_BY_ID: Partial<Record<string, RegExp[]>> = {
  modern_city: [
    /\bcity\b/i,
    /\bdowntown\b/i,
    /\bsubway\b/i,
    /\bskyscraper\b/i,
    /都市/u,
    /城市/u,
    /街区/u,
    /地铁/u,
    /高楼/u,
    /公寓/u,
  ],
  medieval: [
    /\bkingdom\b/i,
    /\bcastle\b/i,
    /\bfortress\b/i,
    /\bknight\b/i,
    /\bfeudal\b/i,
    /王国/u,
    /城堡/u,
    /要塞/u,
    /骑士/u,
    /封地/u,
  ],
  space: [
    /\bspace\b/i,
    /\borbit(?:al)?\b/i,
    /\bstation\b/i,
    /\bspaceship\b/i,
    /\bstarship\b/i,
    /\bplanet\b/i,
    /太空/u,
    /轨道/u,
    /空间站/u,
    /飞船/u,
    /星舰/u,
    /星球/u,
  ],
  post_apocalyptic: [
    /\bwasteland\b/i,
    /\bpost-apocalyptic\b/i,
    /\bbunker\b/i,
    /\bradiation\b/i,
    /\bsurvivor camp\b/i,
    /废土/u,
    /末日/u,
    /废墟/u,
    /避难所/u,
    /辐射/u,
    /幸存者/u,
  ],
  victorian: [
    /\bvictorian\b/i,
    /\bgaslight\b/i,
    /\bmanor\b/i,
    /\bfog-bound\b/i,
    /维多利亚/u,
    /煤气灯/u,
    /庄园/u,
    /雾都/u,
  ],
  east_asian_ancient: [
    /\bwuxia\b/i,
    /\bdynasty\b/i,
    /\bjianghu\b/i,
    /\bimperial court\b/i,
    /古风/u,
    /王朝/u,
    /江湖/u,
    /宗门/u,
    /宫廷/u,
    /古镇/u,
    /书院/u,
  ],
  underwater: [
    /\bunderwater\b/i,
    /\bdeep sea\b/i,
    /\bsea floor\b/i,
    /\bseabed\b/i,
    /\bsunken\b/i,
    /\bocean trench\b/i,
    /水下/u,
    /海底/u,
    /深海/u,
    /海床/u,
    /沉没/u,
    /潜航/u,
    /海沟/u,
    /海渊/u,
    /暗流/u,
  ],
  dreamscape: [
    /\bdreamscape\b/i,
    /\bdream world\b/i,
    /\bdream-city\b/i,
    /\bsurreal\b/i,
    /梦境/u,
    /梦中/u,
    /梦城/u,
    /超现实/u,
    /幻境/u,
  ],
  cyberpunk: [
    /\bcyberpunk\b/i,
    /\bneon\b/i,
    /\bmegacorp\b/i,
    /\bimplant\b/i,
    /\bhacker\b/i,
    /\baugmented\b/i,
    /赛博/u,
    /霓虹/u,
    /义体/u,
    /黑客/u,
    /巨企/u,
    /芯片/u,
  ],
  steampunk: [
    /\bsteampunk\b/i,
    /\bsteam-powered\b/i,
    /\bgear(?:work)?\b/i,
    /\bbrass\b/i,
    /\bairship\b/i,
    /\bclockwork\b/i,
    /蒸汽/u,
    /齿轮/u,
    /黄铜/u,
    /飞艇/u,
    /发条/u,
  ],
  rural_pastoral: [
    /\bfarm\b/i,
    /\bpastoral\b/i,
    /\borchard\b/i,
    /\bharvest\b/i,
    /\bcottage\b/i,
    /乡村/u,
    /田园/u,
    /农场/u,
    /果园/u,
    /麦田/u,
    /村舍/u,
  ],
  tropical_jungle: [
    /\bjungle\b/i,
    /\brainforest\b/i,
    /\bcanopy\b/i,
    /\btropical\b/i,
    /丛林/u,
    /雨林/u,
    /热带/u,
    /藤蔓/u,
    /神庙/u,
  ],
  arctic: [
    /\barctic\b/i,
    /\bpolar\b/i,
    /\bice field\b/i,
    /\bglacier\b/i,
    /\btundra\b/i,
    /\bsnowbound\b/i,
    /极地/u,
    /冰原/u,
    /冰川/u,
    /雪原/u,
    /冻土/u,
  ],
  dungeon: [
    /\bdungeon\b/i,
    /\bcatacomb\b/i,
    /\bunderground labyrinth\b/i,
    /\bcrypt\b/i,
    /\bcavern\b/i,
    /地下城/u,
    /地牢/u,
    /迷宫/u,
    /墓穴/u,
    /洞窟/u,
  ],
  ordinary_person: [
    /\bordinary person\b/i,
    /\bregular person\b/i,
    /\beveryday (?:worker|clerk|courier|student|teacher|resident)\b/i,
    /普通人/u,
    /平凡人/u,
    /寻常人/u,
    /上班族/u,
    /店员/u,
    /快递员/u,
    /学生/u,
    /老师/u,
  ],
  detective: [
    /\bdetective\b/i,
    /\binvestigator\b/i,
    /\bprivate eye\b/i,
    /\bsleuth\b/i,
    /侦探/u,
    /调查员/u,
    /探员/u,
    /私家侦探/u,
  ],
  scientist: [
    /\bscientist\b/i,
    /\bresearcher\b/i,
    /\bscholar\b/i,
    /\bphysicist\b/i,
    /\bbiologist\b/i,
    /\bengineer\b/i,
    /科学家/u,
    /研究员/u,
    /学者/u,
    /工程师/u,
    /博士/u,
  ],
  warrior: [
    /\bwarrior\b/i,
    /\bsoldier\b/i,
    /\bfighter\b/i,
    /\bswordsman\b/i,
    /\bknight\b/i,
    /\bmercenary\b/i,
    /战士/u,
    /士兵/u,
    /武者/u,
    /剑士/u,
    /骑士/u,
    /佣兵/u,
  ],
  child: [
    /\bchild\b/i,
    /\bkid\b/i,
    /\byoungster\b/i,
    /\borphan\b/i,
    /孩子/u,
    /小孩/u,
    /少年/u,
    /少女/u,
    /孩童/u,
    /孤儿/u,
  ],
  elderly: [
    /\belderly\b/i,
    /\bold man\b/i,
    /\bold woman\b/i,
    /\baging\b/i,
    /\bretired\b/i,
    /老人/u,
    /老者/u,
    /老妇/u,
    /老翁/u,
    /退休/u,
  ],
  ai_robot: [
    /\bai\b/i,
    /\bandroid\b/i,
    /\brobot\b/i,
    /\bsynthetic\b/i,
    /AI/u,
    /机器人/u,
    /仿生人/u,
    /机械体/u,
    /人工智能/u,
  ],
  animal: [
    /\banimal\b/i,
    /\bbeast\b/i,
    /\bcat\b/i,
    /\bdog\b/i,
    /\bfox\b/i,
    /\bwolf\b/i,
    /动物/u,
    /兽/u,
    /猫/u,
    /狗/u,
    /狐/u,
    /狼/u,
    /鸟/u,
  ],
  ghost: [
    /\bghost\b/i,
    /\bspirit\b/i,
    /\bphantom\b/i,
    /\bundead\b/i,
    /\bspecter\b/i,
    /\brevenant\b/i,
    /幽灵/u,
    /亡灵/u,
    /鬼魂/u,
    /魂灵/u,
    /怨灵/u,
  ],
  spy: [
    /\bspy\b/i,
    /\bagent\b/i,
    /\boperative\b/i,
    /\binfiltrator\b/i,
    /\bundercover\b/i,
    /间谍/u,
    /特工/u,
    /密探/u,
    /卧底/u,
    /潜伏/u,
  ],
  musician: [
    /\bmusician\b/i,
    /\bsinger\b/i,
    /\bpianist\b/i,
    /\bviolinist\b/i,
    /\bguitarist\b/i,
    /\bcomposer\b/i,
    /音乐家/u,
    /歌手/u,
    /钢琴家/u,
    /小提琴手/u,
    /作曲家/u,
    /演奏家/u,
  ],
  wanderer: [
    /\bwanderer\b/i,
    /\bdrifter\b/i,
    /\bnomad\b/i,
    /\bvagabond\b/i,
    /\broamer\b/i,
    /\btraveler\b/i,
    /流浪者/u,
    /漂泊者/u,
    /旅人/u,
    /浪人/u,
    /游民/u,
    /行脚/u,
  ],
  alien: [
    /\balien\b/i,
    /\bextraterrestrial\b/i,
    /\boffworlder\b/i,
    /外星人/u,
    /异星来客/u,
    /天外来客/u,
  ],
  horror: [
    /\bhorror\b/i,
    /\bterrified\b/i,
    /\bnightmare\b/i,
    /\bblood\b/i,
    /\bcorpse\b/i,
    /\bmonster\b/i,
    /\bscream\b/i,
    /\bdevour\b/i,
    /恐怖/u,
    /惊骇/u,
    /噩梦/u,
    /鲜血/u,
    /尸/u,
    /怪物/u,
    /尖叫/u,
    /吞噬/u,
  ],
  suspense: [
    /\bsuspense\b/i,
    /\bmystery\b/i,
    /\bclue\b/i,
    /\binvestigat(?:e|ion)\b/i,
    /\bsecret\b/i,
    /\btruth\b/i,
    /\bcase\b/i,
    /悬疑/u,
    /谜/u,
    /线索/u,
    /调查/u,
    /秘密/u,
    /真相/u,
    /案件/u,
    /疑点/u,
  ],
  passionate: [
    /\bpassionate\b/i,
    /\brival\b/i,
    /\btournament\b/i,
    /\bprove\b/i,
    /\bvictory\b/i,
    /\bchallenge\b/i,
    /\bbreakthrough\b/i,
    /\bvow\b/i,
    /热血/u,
    /对决/u,
    /挑战/u,
    /证明/u,
    /胜利/u,
    /突破/u,
    /誓言/u,
  ],
  healing: [
    /\bhealing\b/i,
    /\bgentle\b/i,
    /\bcomfort\b/i,
    /\bwarmth\b/i,
    /\breunion\b/i,
    /\bmend\b/i,
    /\bkindness\b/i,
    /治愈/u,
    /温柔/u,
    /抚慰/u,
    /重逢/u,
    /疗愈/u,
    /陪伴/u,
    /和解/u,
  ],
  lonely: [
    /\blonely\b/i,
    /\balone\b/i,
    /\bsolitary\b/i,
    /\bisolated\b/i,
    /\bdistant\b/i,
    /\bsilence\b/i,
    /\babandoned\b/i,
    /孤独/u,
    /独自/u,
    /寂寞/u,
    /失联/u,
    /无人/u,
    /寂静/u,
    /被遗弃/u,
  ],
  thrilling: [
    /\bthrilling\b/i,
    /\bchase\b/i,
    /\bcollapse\b/i,
    /\bescape\b/i,
    /\burgent\b/i,
    /\brace\b/i,
    /\bsurge\b/i,
    /\bpanic\b/i,
    /\bsplit-second\b/i,
    /\bhigh-stakes\b/i,
    /紧张/u,
    /刺激/u,
    /追逐/u,
    /崩塌/u,
    /逃生/u,
    /抢在/u,
    /失控/u,
    /极速/u,
    /惊险/u,
    /翻涌/u,
    /震动/u,
  ],
  melancholic: [
    /\bmelancholic\b/i,
    /\bsorrow\b/i,
    /\bregret\b/i,
    /\bfading\b/i,
    /\bmemory\b/i,
    /\bmourning\b/i,
    /\bgrief\b/i,
    /\bwistful\b/i,
    /忧伤/u,
    /哀伤/u,
    /失落/u,
    /回忆/u,
    /追悼/u,
    /遗憾/u,
    /惆怅/u,
  ],
  eerie: [
    /\beerie\b/i,
    /\buncanny\b/i,
    /\bwhisper\b/i,
    /\bshadow\b/i,
    /\bstrange\b/i,
    /\bunnerving\b/i,
    /诡异/u,
    /不对劲/u,
    /阴影/u,
    /低语/u,
    /古怪/u,
    /毛骨悚然/u,
  ],
  cheerful: [
    /\bcheerful\b/i,
    /\bjoyful\b/i,
    /\blively\b/i,
    /\bfestival\b/i,
    /\bbright\b/i,
    /\bplayful\b/i,
    /\blaugh\b/i,
    /欢快/u,
    /明亮/u,
    /热闹/u,
    /节庆/u,
    /轻快/u,
    /嬉闹/u,
  ],
  meditative: [
    /\bmeditative\b/i,
    /\bstillness\b/i,
    /\bquiet\b/i,
    /\bbreathe\b/i,
    /\bcontemplat(?:e|ion)\b/i,
    /\bcalm rhythm\b/i,
    /冥想/u,
    /静默/u,
    /平静/u,
    /呼吸/u,
    /澄明/u,
    /缓慢/u,
  ],
};

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
  horror: "to get through what should have been an ordinary assignment",
  suspense: "to make sense of a situation nobody there can explain clearly",
  passionate: "to prove they can handle the hardest challenge waiting there",
  healing: "hoping this place might offer a brief chance to start over",
  lonely: "hoping to recover something they thought they had already let go of",
  thrilling: "to stay ahead of a situation that keeps shifting under their feet",
  melancholic: "hoping to recover something they thought they had already let go of",
  eerie: "to get through what should have been an ordinary assignment",
  cheerful: "hoping this place might offer a brief chance to start over",
  meditative: "hoping this place might offer a brief chance to start over",
};

const ZH_EMERGENCY_GOAL_BY_MOOD_ID: Partial<Record<string, string>> = {
  horror: "，原本只想把一件看似普通的差事平稳做完",
  suspense: "，想弄清一件所有人都说不明白的异常",
  passionate: "，决心证明自己能扛住这里最难的一次考验",
  healing: "，希望在那里重新找回一点平静",
  lonely: "，想找回某个自己以为已经放下的东西",
  thrilling: "，打算抢在局势彻底失控前先看清它的走向",
  melancholic: "，想找回某个自己以为已经放下的东西",
  eerie: "，原本只想把一件看似普通的差事平稳做完",
  cheerful: "，希望在那里重新找回一点平静",
  meditative: "，希望在那里重新找回一点平静",
};

const EN_EMERGENCY_HOOK_BY_MOOD_ID: Partial<Record<string, string>> = {
  horror:
    "But the first sign that something is wrong feels as if it has been waiting specifically for them.",
  suspense:
    "Yet the more clues they gather, the more the place seems to be preparing for an event that has not happened yet.",
  passionate:
    "Soon they realize the real test is not the obstacle in front of them, but the choice waiting just behind it.",
  healing:
    "By evening, the place's quiet routines begin pointing toward a truth nobody there has said aloud.",
  lonely:
    "Then one small trace suggests that what they came looking for may have been searching for them too.",
  thrilling:
    "But every step forward leaves behind evidence that someone has already arranged the next move.",
  melancholic:
    "Then one small trace suggests that what they came looking for may have been searching for them too.",
  eerie:
    "But the first sign that something is wrong feels as if it has been waiting specifically for them.",
  cheerful:
    "The warmer the place seems, the more carefully it appears to be hiding a secret beneath that calm.",
  meditative:
    "The quieter everything becomes, the more clearly an unanswered question begins taking shape beneath it.",
};

const ZH_EMERGENCY_HOOK_BY_MOOD_ID: Partial<Record<string, string>> = {
  horror: "可第一处不对劲的痕迹，像是早就知道他会在这一天来到这里。",
  suspense: "可线索越往前推进，越像是在替一件尚未发生的事提前腾出位置。",
  passionate: "很快他就发现，真正的考验不在眼前，而在下一次不得不做出的选择里。",
  healing: "可到了傍晚，那里的平静日常却一点点把他推向一个谁都没有说出口的真相。",
  lonely: "随后，一点微弱的痕迹让他意识到，自己在寻找的东西也许一直在反过来寻找他。",
  thrilling: "可每往前一步，现场都像早有人替他安排好了下一步会撞见的东西。",
  melancholic: "随后，一点微弱的痕迹让他意识到，自己在寻找的东西也许一直在反过来寻找他。",
  eerie: "可第一处不对劲的痕迹，像是早就知道他会在这一天来到这里。",
  cheerful: "可越是温柔安稳的日常，越像在替某个尚未说破的秘密打掩护。",
  meditative: "可越是安静缓慢的日常，越让人察觉到其中藏着一个始终没人正面回答的问题。",
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
    "at a place that no longer feels entirely connected to the outside world";
  const protagonist =
    EN_EMERGENCY_PROTAGONIST_BY_ID[context.protagonistTagId ?? ""] ??
    "someone who thought they were only passing through";
  const goal =
    EN_EMERGENCY_GOAL_BY_MOOD_ID[context.moodTagId ?? ""] ??
    "to deal with the problem everyone there has learned not to name";
  const firstSentence = capitalizeSentence(`${protagonist} arrives ${setting} ${goal}.`);

  if (context.customLabels.length >= 2) {
    return `${firstSentence} Every useful clue keeps tying "${context.customLabels[0]}" to "${context.customLabels[1]}", as if both belong to the same unfinished event.`;
  }

  if (context.customLabels.length === 1) {
    return `${firstSentence} The first solid clue points to something the locals only call "${context.customLabels[0]}", and nobody can agree whether it is a place, a person, or a mistake they keep repeating.`;
  }

  return `${firstSentence} ${
    EN_EMERGENCY_HOOK_BY_MOOD_ID[context.moodTagId ?? ""] ??
    "Before they can settle in, one small inconsistency suggests the real story there began long before their arrival."
  }`;
}

function buildChineseEmergencyPremise(context: EmergencyPremiseContext) {
  const setting =
    ZH_EMERGENCY_SETTING_BY_ID[context.worldTagId ?? ""] ?? "一处忽然和外界失去步调的地方";
  const protagonist =
    ZH_EMERGENCY_PROTAGONIST_BY_ID[context.protagonistTagId ?? ""] ?? "本以为自己只是路过的人";
  const goal =
    ZH_EMERGENCY_GOAL_BY_MOOD_ID[context.moodTagId ?? ""] ?? "，准备处理一件所有人都学会避而不谈的麻烦";
  const firstSentence = `一名${protagonist}来到${setting}${goal}。`;

  if (context.customLabels.length >= 2) {
    return `${firstSentence} 所有像样的线索最后都把“${context.customLabels[0]}”和“${context.customLabels[1]}”牵回同一件尚未成形的事件里。`;
  }

  if (context.customLabels.length === 1) {
    return `${firstSentence} 第一条像样的线索只指向人们口中的“${context.customLabels[0]}”，可没人说得清那究竟是一个地方、一个人，还是某种总在重演的错误。`;
  }

  return `${firstSentence}${
    ZH_EMERGENCY_HOOK_BY_MOOD_ID[context.moodTagId ?? ""] ??
    "可还没等他站稳脚跟，最细小的一处不协调就已经说明，这里的故事早在他抵达之前便开始了。"
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

function matchesSelectedTag(premise: string, tag: PremiseGenerationTag) {
  if (tag.isCustom) {
    return true;
  }

  const patterns = PRESET_TAG_MATCH_PATTERNS_BY_ID[tag.id];
  return patterns ? patterns.some((pattern) => pattern.test(premise)) : true;
}

function findMissingSelectedTags(input: PremiseGenerationInput, premise: string) {
  return input.selectedTags.filter((tag) => !matchesSelectedTag(premise, tag));
}

function buildSystemPrompt(language: Language, hasTags: boolean) {
  if (language === "zh") {
    return `你是 Echoverse 的故事前提写作者。你只输出一个 JSON 对象，格式固定为 {"premise":"..."}。

硬性要求：
- premise 字段里只能写可直接展示给用户看的故事前提正文
- 必须全程使用简体中文，不要夹杂英文或其他语言
- 必须写成 2 到 3 句话
- 尽快建立主角、当前处境、目标或正在发生的问题
- 自然埋下一处未解决的叙事钩子或伏笔，但形式必须服从标签和整体气质，不要强行套用固定的倒计时、失踪案、封锁或警告模板
- 有标签时，所有已选标签都必须让没看过标签列表的读者也能直接读出来；世界设定要靠具体环境细节落地，主角标签要在主角身份上清晰可辨，情绪标签要体现在节奏、气质或风险里
- 必须给后续剧情发展留下空间
- ${hasTags ? "有标签时，必须用标签来构建故事前提，让标签体现在设定、主角、冲突、氛围或悬念里；不要把标签名直接列表写进结果" : "没有标签时，必须自行随机决定题材、氛围、主角身份和核心冲突，并给出新鲜组合"}
- 不要输出标题、分析、说明、标签列表、Markdown，或 JSON 以外的任何文字`;
  }

  return `You are Echoverse's story-premise writer. Return exactly one JSON object in the form {"premise":"..."}.

Hard requirements:
- The premise field must contain only a player-facing story premise
- Write entirely in English and do not switch languages
- Write exactly 2 to 3 sentences
- Establish the protagonist, situation, goal, or immediate problem quickly
- Add one unresolved hook or piece of foreshadowing naturally, but let its form follow the tags and overall tone instead of forcing a stock countdown, disappearance, lockdown, or warning template
- When tags are provided, every selected tag must be clearly recognizable even to a reader who never saw the tag list: make world tags visible through concrete setting details, protagonist tags visible in the protagonist identity, and mood tags visible in the pacing, atmosphere, or stakes
- Leave clear room for later story development
- ${hasTags ? "When tags are provided, use them to build the premise so they shape the setting, protagonist, conflict, mood, or suspense; do not list the tag names in the result" : "When no tags are provided, randomly invent the genre, atmosphere, protagonist identity, and central conflict yourself, and keep the combination fresh"}
- Do not output a title, analysis, commentary, tag list, markdown, or any text outside the JSON object`;
}

function buildAttemptPrompt(input: PremiseGenerationInput, isRetry: boolean) {
  const tagList = formatTagList(input.selectedTags, input.language);

  if (input.language === "zh") {
    if (input.selectedTags.length > 0) {
      return isRetry
        ? `上一个结果虽然是可解析的 JSON，但里面的故事前提还不够像可直接展示给用户的成品，或者没有把所有标签清楚落到前提里。请重新输出一个 JSON 对象，并继续认真使用这些标签来构建故事前提：${tagList}。如果其中有自定义标签，请把它们自然融入设定、人物或冲突，不要解释标签，也不要套用固定桥段。最终结果必须让读者不看标签列表也能看出这些标签真的参与了构建。`
        : `请输出一个 JSON 对象，并使用这些标签来构建故事前提：${tagList}。如果其中有自定义标签，请把它们自然融入设定、人物或冲突，不要只把标签当成表面装饰，也不要套用固定模板。所有标签都必须清楚体现在前提里，而不是换一组标签也照样成立。`;
    }

    return isRetry
      ? "上一个结果虽然是可解析的 JSON，但里面的故事前提还不够像可直接展示给用户的成品。请重新随机生成一个原创故事前提，自然埋下伏笔，并且只输出 JSON 对象。"
      : "用户没有选择任何标签。请随机生成一个原创故事前提，并且只输出 JSON 对象。";
  }

  if (input.selectedTags.length > 0) {
    return isRetry
      ? `The previous result was parseable JSON, but the premise was still not display-ready or did not clearly reflect every selected tag. Return a new JSON object and keep using these tags to build the story premise: ${tagList}. If any tag is custom, weave it naturally into the setting, character, or conflict without explaining it, and avoid falling back to stock plot beats. The final premise must make those tags obvious even if the reader never saw the tag list.`
      : `Return one JSON object and use these tags to build the story premise: ${tagList}. If any tag is custom, integrate it naturally into the setting, character, or conflict instead of treating it as decoration, and avoid stock premise templates. Every selected tag must be clearly reflected in the premise rather than loosely implied.`;
  }

  return isRetry
    ? "The previous result was parseable JSON, but the premise was still not display-ready. Randomly generate a fresh original story premise with natural foreshadowing and return JSON only."
    : "The user selected no tags. Randomly generate one original story premise and return JSON only.";
}

function buildFallbackPrompt(input: PremiseGenerationInput) {
  const tagList = formatTagList(input.selectedTags, input.language);

  if (input.language === "zh") {
    return input.selectedTags.length > 0
      ? `忽略之前的格式问题，重新直接写一段可展示给用户的故事前提正文。只输出故事前提本身，不要 JSON、标题、说明、标签列表或 Markdown。请继续自然融入这些标签：${tagList}，并留下一处自然伏笔，不要硬套固定桥段。所有标签都必须清楚落到前提里，而不是只剩下模糊气质。`
      : "忽略之前的格式问题，重新随机写一段可展示给用户的原创故事前提正文。只输出故事前提本身，不要 JSON、标题、说明、标签列表或 Markdown。请自然留下一处伏笔，不要硬套固定桥段。";
  }

  return input.selectedTags.length > 0
    ? `Ignore the earlier formatting issues and write one user-facing story premise directly. Output only the premise itself, with no JSON, title, commentary, tag list, or markdown. Keep naturally using these tags: ${tagList}, add one natural piece of foreshadowing, and avoid stock plot beats. Every selected tag must still be clearly visible in the result instead of dissolving into a generic premise.`
    : "Ignore the earlier formatting issues and write one original user-facing story premise directly. Output only the premise itself, with no JSON, title, commentary, tag list, or markdown. Add one natural piece of foreshadowing and avoid stock plot beats.";
}

function evaluatePremiseCandidate(
  value: unknown,
  input: PremiseGenerationInput,
): PremiseCandidateEvaluation | null {
  const premise = cleanGeneratedPremise(extractGeneratedPremise(value));

  if (!premise) {
    return null;
  }

  if (findMissingSelectedTags(input, premise).length > 0) {
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

    const candidate = evaluatePremiseCandidate(result, input);

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

  const fallbackCandidate = evaluatePremiseCandidate(fallbackText, input);

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
