"use client";

import { useState, useCallback, KeyboardEvent, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { STORY_TAGS, getStoryTagLabel, isPresetStoryTag, type TagCategory } from "@/lib/constants/story-tags";
import { DURATION_OPTIONS } from "@/lib/constants/defaults";
import { listCustomTags } from "@/lib/db";
import { buildLocalPremiseFallback, generateStoryPremise } from "@/lib/engine/premise-generator";
import { advanceStory, createStoryExperience } from "@/lib/engine/story-runtime";
import { LlmRequestError } from "@/lib/services/llm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, X, Loader2, Wand2, Globe, Heart, Users, PenLine, Settings } from "lucide-react";
import { toast } from "sonner";

const TAG_ICONS: Record<string, React.ReactNode> = {
  world: <Globe size={14} />,
  mood: <Heart size={14} />,
  protagonist: <Users size={14} />,
};

const PREMISE_VARIATION_CUES = {
  zh: [
    "从一个被提前记录下来的未来痕迹切入",
    "让异常先出现，原因暂时缺席",
    "把冲突藏在一条看似普通的日常规则里",
    "让主角先撞见结果，再倒逼问题浮现",
    "把秘密藏进一件不合时宜出现的物件",
    "让熟悉的人或地方先出现细微错位",
    "让危险带着邀请感，而不是直接威胁",
    "让第一条线索像是专门留给主角的",
    "把伏笔落在一条反常记录或名单上",
    "让故事从一次误认、误投或误入开始",
  ],
  en: [
    "open on evidence from the future arriving too early",
    "let the anomaly appear before its cause",
    "hide the conflict inside an ordinary local rule",
    "make the protagonist see the outcome before the problem",
    "bury the secret inside an object that appears at the wrong time",
    "tilt a familiar place or person slightly out of alignment",
    "make the danger arrive in the shape of an invitation",
    "let the first clue feel intentionally left for the protagonist",
    "anchor the hook in a wrong record, list, or log entry",
    "begin with a mistaken delivery, identity, or entry",
  ],
} as const;

function buildPremiseVariationHint(lang: "en" | "zh") {
  const cues = PREMISE_VARIATION_CUES[lang];
  const cue = cues[Math.floor(Math.random() * cues.length)] ?? cues[0];
  const nonce = Math.random().toString(36).slice(2, 6);

  return lang === "zh" ? `${cue}（变化码 ${nonce}）` : `${cue} (variation ${nonce})`;
}

function normalizePremiseHistoryEntry(raw: string) {
  return raw.trim().toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

function buildPremiseHistoryKey(lang: "en" | "zh", selected: string[]) {
  return `${lang}::${[...selected].sort().join("|")}`;
}

function appendPremiseHistory(existing: string[], nextPremise: string) {
  const normalizedNext = normalizePremiseHistoryEntry(nextPremise);

  if (!normalizedNext) {
    return existing;
  }

  const deduped = existing.filter(
    (entry) => normalizePremiseHistoryEntry(entry) !== normalizedNext,
  );

  return [...deduped, nextPremise].slice(-4);
}

function hasSameItems(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function isLikelyLlmConfigurationError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (error instanceof LlmRequestError) {
    if (error.status === 401 || error.status === 403) {
      return true;
    }

    if (error.status === 404 && /model|base url|endpoint|not found/i.test(message)) {
      return true;
    }

    if (
      error.status === 400 &&
      /api key|base url|model|header|configuration|authorization|authentication|missing/i.test(
        message,
      )
    ) {
      return true;
    }
  }

  return /invalid api key|incorrect api key|unauthorized|authentication|authorization|missing llm configuration|missing x-llm|model .* does not exist|unknown model/i.test(
    message,
  );
}

function getPremiseGenerationErrorMessage(error: unknown, lang: "en" | "zh") {
  const message = error instanceof Error ? error.message : "";

  if (/premise was invalid|could not parse json|empty response|llm response was empty/i.test(message)) {
    return t("create.premise.invalidResponse", lang);
  }

  if (isLikelyLlmConfigurationError(error)) {
    return t("create.premise.configFailed", lang);
  }

  return t("create.premise.genFailed", lang);
}

const CreateStoryPage = () => {
  const router = useRouter();
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);
  const llmConfig = useSettingsStore((s) => s.llm);
  const hasValidatedServiceConfiguration = useSettingsStore((s) => s.hasValidatedServiceConfiguration());
  const hasRequiredConfiguration = useSettingsStore((s) => s.hasRequiredConfiguration());
  const savedCustomTags = useSettingsStore((s) => s.customTags);
  const setCustomTagsStore = useSettingsStore((s) => s.setCustomTags);

  const [premise, setPremise] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [duration, setDuration] = useState<"short" | "medium" | "long">("medium");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const recentGeneratedPremisesRef = useRef<Map<string, string[]>>(new Map());
  const customTags = savedCustomTags;
  const defaultPremise = t("create.premise.placeholder", lang);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const addCustomTag = useCallback(() => {
    const tag = customInput.trim();
    if (tag && !customTags.includes(tag)) {
      const next = [...customTags, tag];
      setCustomTagsStore(next);
      setSelectedTags((previous) => (previous.includes(tag) ? previous : [...previous, tag]));
      setCustomInput("");
    }
  }, [customInput, customTags, setCustomTagsStore]);

  const removeCustomTag = (tag: string) => {
    const next = customTags.filter((t) => t !== tag);
    setCustomTagsStore(next);
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      addCustomTag();
    }
  };

  const clearAll = () => {
    setSelectedTags([]);
  };

  const allSelected = selectedTags;

  const generatePremiseSuggestion = async () => {
    if (!llmConfig.apiKey) {
      toast.error(t("create.premise.noApiKey", lang));
      return;
    }

    const premiseInput = {
      language: lang,
      selectedTags: allSelected.map((tag) => ({
        id: tag,
        label: getStoryTagLabel(tag, lang),
        isCustom: !isPresetStoryTag(tag),
      })),
      variationHint: buildPremiseVariationHint(lang),
      avoidPremises: (() => {
        const historyKey = buildPremiseHistoryKey(lang, allSelected);
        const history = recentGeneratedPremisesRef.current.get(historyKey) ?? [];
        const currentPremise = premise.trim();

        return currentPremise
          ? appendPremiseHistory(history, currentPremise)
          : history;
      })(),
    } as const;
    const historyKey = buildPremiseHistoryKey(lang, allSelected);

    setIsGenerating(true);

    try {
      const result = await generateStoryPremise(llmConfig, premiseInput);

      setPremise(result.premise);
      recentGeneratedPremisesRef.current.set(
        historyKey,
        appendPremiseHistory(
          recentGeneratedPremisesRef.current.get(historyKey) ?? [],
          result.premise,
        ),
      );
      return;

      /*
      const tagLabels = allSelected.map((tag) => {
        for (const cat of Object.values(STORY_TAGS)) {
          const found = cat.options.find((o) => o.id === tag);
          if (found) {
            return found.label[lang];
          }
        }

        return tag;
      });
      const hasElements = tagLabels.length > 0;
      const elementsStr = tagLabels.join(", ");
      const selectedTagSet = new Set(allSelected);
      const prefersSuspense = ["horror", "suspense", "thrilling", "eerie"].some((tag) => selectedTagSet.has(tag));
      const prefersWarmth = ["healing", "cheerful", "meditative"].some((tag) => selectedTagSet.has(tag));
      const prefersMelancholy = ["melancholic", "lonely"].some((tag) => selectedTagSet.has(tag));
      const prefersMomentum = ["passionate"].some((tag) => selectedTagSet.has(tag));
      const hookRequirement = lang === "zh"
        ? hasElements
          ? "- 必须有明确的叙事钩子，但形式要服从用户选择的标签和情绪色彩"
          : "- 必须有明确的叙事钩子，并让整体像一次真正随机产生的原创概念，而不是默认模板"
        : hasElements
          ? "- The premise must contain a clear narrative hook, but its form must match the selected tags and emotional tone"
          : "- The premise must contain a clear narrative hook and feel like a genuinely original random concept, not a default template";
      const toneGuidance = lang === "zh"
        ? prefersSuspense
          ? "- 叙事钩子应偏向谜团、异常、危险、压迫感或未知真相"
          : prefersWarmth
            ? "- 叙事钩子应偏向情感牵引、关系变化、愿望、微妙异常或尚未实现的期待，不要硬写成危险悬疑"
            : prefersMelancholy
              ? "- 叙事钩子应偏向失落、记忆、关系裂痕、未完成的心愿或未说出口的问题"
              : prefersMomentum
                ? "- 叙事钩子应偏向目标、冲突、挑战、赌注或即将到来的抉择"
                : "- 至少给出一个明确的叙事钩子，例如欲望、矛盾、异常、风险、秘密、问题或期待"
        : prefersSuspense
          ? "- The story hook should lean into mystery, anomaly, danger, pressure, or an unknown truth"
          : prefersWarmth
            ? "- The story hook should come from emotional pull, changing relationships, desire, subtle oddity, or a not-yet-fulfilled hope, not forced danger"
            : prefersMelancholy
              ? "- The story hook should come from loss, memory, a strained relationship, unfinished longing, or an unspoken question"
              : prefersMomentum
                ? "- The story hook should come from pursuit, conflict, challenge, stakes, or an imminent choice"
                : "- Include at least one clear story hook such as desire, contradiction, anomaly, risk, secret, question, or anticipation";
      const tagGuidance = lang === "zh"
        ? hasElements
          ? `- 必须认真参考并自然融合这些标签：${elementsStr}\n- 不要忽略标签，也不要只把标签写成表面装饰`
          : "- 用户没有选择任何标签。你必须自行随机决定题材、氛围、主角身份和核心冲突\n- 每次都尽量给出新鲜组合，不要复用默认占位前提，也不要总是重复太空站、失忆、电台等常见模板"
        : hasElements
          ? `- You must actively use and naturally integrate these tags: ${elementsStr}\n- Do not ignore the tags or reduce them to superficial decoration`
          : "- The user selected no tags. You must randomly choose the genre, atmosphere, protagonist type, and central conflict yourself\n- Aim for a fresh combination each time; do not fall back to a stock default premise or keep repeating the same familiar tropes";
      const firstAttemptInstruction = lang === "zh"
        ? hasElements
          ? `请参考这些标签，直接写出一个可展示给用户的故事前提成品：${elementsStr}。不要复述请求，不要列规则。`
          : "用户没有选择任何标签。请随机生成一个原创、完整、具体、可直接展示给用户的故事前提成品，并自行决定题材、主角与核心冲突；不要复述请求，不要列规则。"
        : hasElements
          ? `Generate one complete story premise that can be shown directly to the user and actively reflect these tags: ${elementsStr}. Write the premise itself, not the request or the rules.`
          : "The user selected no tags. Randomly generate one original, complete story premise that can be shown directly to the user, and choose the genre, protagonist, and core conflict yourself. Write the premise itself, not the request or the rules.";
      const retryInstruction = lang === "zh"
        ? hasElements
          ? `上一个结果无效，因为它像说明文字而不是故事前提。请重新生成一个完整、具体、可直接展示给用户的故事前提，并继续认真参考这些标签：${elementsStr}；不要复述请求、列规则、解释标签，也不要使用省略号、占位词或模板句。`
          : "上一个结果无效，因为它像说明文字而不是故事前提。用户没有选择任何标签。请重新随机生成一个完整、具体、可直接展示给用户的原创故事前提；不要复述请求、列规则、使用省略号、占位词或模板句，也不要回到常见模板。"
        : hasElements
          ? `The previous result was invalid because it read like instructions instead of a story premise. Generate a complete, specific story premise that can be shown directly to the user and still actively reflect these tags: ${elementsStr}; do not restate the request, list rules, explain the tags, or use ellipses, placeholders, or template lines.`
          : "The previous result was invalid because it read like instructions instead of a story premise. The user selected no tags. Randomly generate a complete, specific, original story premise that can be shown directly to the user; do not restate the request, list rules, use ellipses, placeholders, template lines, or default stock concepts.";

      const systemPrompt = lang === "zh"
        ? `你是一个专门写“故事前提”的互动叙事策划师。

硬性要求：
- 只写一个“故事前提”，不是大纲，不是设定说明，不是分析
- 2 到 3 句话
- 第一时间建立主角、处境或目标
${hookRequirement}
- 给后续剧情留下很大展开空间
- 有故事标签时，需要使用标签来构建故事前提；没有标签时，需要自行随机决定题材、氛围、主角身份和核心冲突
${toneGuidance}
${tagGuidance}

输出格式：
直接输出故事前提，不要任何额外说明。
示例：
暴雨切断山路后，一名临时代班的深夜电台主持人开始接到只在凌晨三点响起的来电。对方总能提前说中小镇第二天会发生的事，而最后一次通话里传来的，是她自己的声音。`
        : `You are an interactive fiction concept writer who specializes in writing "story premises."

Hard requirements:
- Write only one "story premise", not an outline, not worldbuilding notes, not analysis
- 2 to 3 sentences
- Immediately establish protagonist, situation, or goal
${hookRequirement}
- Leave substantial room for later story development
- When story tags are provided, use them to build the story premise; when no tags are provided, randomly decide the genre, atmosphere, protagonist identity, and central conflict yourself
${toneGuidance}
${tagGuidance}

Output format:
Directly output the story premise. Do not include any extra explanation.
Example:
A substitute host at a late-night radio station keeps receiving calls that describe tomorrow's events before they happen. On the fourth night, the caller stops predicting the town's future and starts warning her about her own missing memories.`;

      const finalRetryInstruction = lang === "zh"
        ? hasElements
          ? `上一个结果仍然无效。忽略你之前的回答，重新写一个可直接展示给用户的故事前提，并继续认真参考这些标签：${elementsStr}。这次只输出故事前提正文本身，精确写成 2 到 3 句话，不要任何前缀、标签、解释或格式说明。`
          : "上一个结果仍然无效。忽略你之前的回答，重新随机写一个可直接展示给用户的原创故事前提。这次只输出故事前提正文本身，精确写成 2 到 3 句话，不要任何前缀、标签、解释或格式说明。"
        : hasElements
          ? `The previous result was still invalid. Ignore your earlier reply and write a fresh story premise that can be shown directly to the user while still actively reflecting these tags: ${elementsStr}. This time output only the premise itself in exactly 2 to 3 sentences, with no label, tags, explanation, or formatting notes.`
          : "The previous result was still invalid. Ignore your earlier reply and write a fresh original story premise that can be shown directly to the user. This time output only the premise itself in exactly 2 to 3 sentences, with no label, tags, explanation, or formatting notes.";

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemPrompt },
        ];

        messages.push({
          role: "user",
          content: attempt === 0 ? firstAttemptInstruction : attempt === 1 ? retryInstruction : finalRetryInstruction,
        });

        const result = await generateLlmText(
          llmConfig,
          messages,
          {
            max_tokens: 260,
            temperature: attempt === 0 ? (hasElements ? 0.85 : 1) : attempt === 1 ? (hasElements ? 0.75 : 0.9) : 0.65,
          },
        );

        const nextPremise = extractGeneratedPremise(result);

        if (isMeaningfulPremise(nextPremise)) {
          setPremise(nextPremise);
          return;
        }
      }

      throw new Error("Premise was invalid");
      */
    } catch (error) {
      console.error(error);

      if (isLikelyLlmConfigurationError(error)) {
        toast.error(getPremiseGenerationErrorMessage(error, lang));
        return;
      }

      const fallback = buildLocalPremiseFallback(premiseInput);
      setPremise(fallback.premise);
      recentGeneratedPremisesRef.current.set(
        historyKey,
        appendPremiseHistory(
          recentGeneratedPremisesRef.current.get(historyKey) ?? [],
          fallback.premise,
        ),
      );
      toast.warning(
        lang === "zh"
          ? "AI 前提生成失败，已改用本地备用前提。"
          : "AI premise generation failed, so a local fallback premise was used.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const startJourney = async () => {
    if (!hasRequiredConfiguration) {
      router.push("/settings");
      return;
    }

    setIsLoading(true);
    try {
      const actualPremise = premise.trim() || defaultPremise;
      setLoadingStep(1);

      const story = await createStoryExperience(
        {
          llm: llmConfig,
          elevenlabs: useSettingsStore.getState().elevenlabs,
          turbopuffer: useSettingsStore.getState().turbopuffer,
          voice: useSettingsStore.getState().voice,
          preferences: useSettingsStore.getState().preferences,
          customTags: useSettingsStore.getState().customTags,
          onboardingCompleted: useSettingsStore.getState().onboardingCompleted,
        },
        {
          premise: actualPremise,
          selectedPresetTags: selectedTags.filter((tag) => isPresetStoryTag(tag)),
          selectedCustomTags: selectedTags.filter((tag) => !isPresetStoryTag(tag)),
          storyLanguage: useSettingsStore.getState().preferences.storyLang,
          duration,
        },
      );

      setLoadingStep(2);
      await advanceStory(
        {
          llm: llmConfig,
          elevenlabs: useSettingsStore.getState().elevenlabs,
          turbopuffer: useSettingsStore.getState().turbopuffer,
          voice: useSettingsStore.getState().voice,
          preferences: useSettingsStore.getState().preferences,
          customTags: useSettingsStore.getState().customTags,
          onboardingCompleted: useSettingsStore.getState().onboardingCompleted,
        },
        story,
      );
      setLoadingStep(3);
      router.push(`/play/${story.id}`);
    } catch (error) {
      console.error(error);
      toast.error(lang === "zh" ? "故事生成失败，请检查配置后重试" : "Story generation failed. Check your configuration and try again.");
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  useEffect(() => {
    let cancelled = false;

    void listCustomTags()
      .then((tags) => {
        if (cancelled) {
          return;
        }

        const merged = Array.from(new Set([...savedCustomTags, ...tags.map((tag) => tag.text)]));
        if (!hasSameItems(savedCustomTags, merged)) {
          setCustomTagsStore(merged);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [savedCustomTags, setCustomTagsStore]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/[0.04] animate-glow-pulse" />
        </div>
        <motion.div
          className="relative z-10 text-center space-y-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Audio waveform animation */}
          <div className="flex items-end justify-center gap-[3px] h-16 mx-auto">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full bg-accent"
                animate={{
                  height: [8, 24 + Math.random() * 32, 12, 32 + Math.random() * 24, 8],
                }}
                transition={{
                  duration: 1.2 + Math.random() * 0.6,
                  delay: i * 0.08,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
          <div className="space-y-3">
            {[
              { step: 1, text: t("create.loading.world", lang) },
              { step: 2, text: t("create.loading.audio", lang) },
              { step: 3, text: t("create.loading.ready", lang) },
            ].map((s) => (
              <motion.p
                key={s.step}
                className={`text-lg font-serif ${loadingStep >= s.step ? "text-foreground" : "text-muted-foreground/30"}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: loadingStep >= s.step ? 1 : 0.3, x: 0 }}
                transition={{ delay: s.step * 0.5 }}
              >
                {loadingStep > s.step && <span className="text-accent mr-2">✓</span>}
                {loadingStep === s.step && <Loader2 size={14} className="inline mr-2 animate-spin text-accent" />}
                {s.text}
              </motion.p>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="app-shell-page relative bg-background">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--accent)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--accent)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} />
          </Button>
          <h1 className="text-2xl font-bold font-serif text-accent">{t("create.title", lang)}</h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {!hasValidatedServiceConfiguration ? (
            <section className="glass-panel-strong border-accent/20 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <h2 className="font-serif text-lg text-foreground">{t("create.setupRequired.title", lang)}</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t("create.setupRequired.desc", lang)}
                  </p>
                </div>
                <Button
                  onClick={() => router.push("/settings")}
                  variant="outline"
                  className="border-accent/30 hover:border-accent/60 hover:bg-accent/10"
                >
                  <Settings size={16} className="mr-2" />
                  {t("create.openSettings", lang)}
                </Button>
              </div>
            </section>
          ) : null}

          {/* Tags */}
          <section className="glass-panel-strong p-6 space-y-5">
            <div className="space-y-2">
              <h2 className="text-xs text-muted-foreground font-mono tracking-wider uppercase">{t("create.tags.title", lang)}</h2>
            </div>

            {(Object.keys(STORY_TAGS) as TagCategory[]).map((category) => {
              const cat = STORY_TAGS[category];

              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground">
                    {TAG_ICONS[category] || <Globe size={14} />}
                    <span>{cat.label[lang]}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cat.options.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => toggleTag(option.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all duration-200 ${
                          selectedTags.includes(option.id)
                            ? "bg-accent/15 border-accent/40 text-accent glow-accent"
                            : "hover-surface border-border/50 text-muted-foreground"
                        }`}
                      >
                        {option.label[lang]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Custom tags */}
            <div className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <PenLine size={14} /> {t("create.tags.custom", lang)}
              </span>
              <div className="flex gap-2">
                <Input
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("create.tags.customPlaceholder", lang)}
                  className="input-game flex-1"
                />
                <Button
                  variant="outline"
                  onClick={addCustomTag}
                  disabled={!customInput.trim()}
                  className="border-accent/30 hover:border-accent/60 hover:bg-accent/5"
                >
                  {t("create.tags.add", lang)}
                </Button>
              </div>
              {customTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <span
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-accent/15 border border-accent/40 text-accent"
                            : "hover-surface bg-secondary/50 border border-border/30 text-muted-foreground"
                        }`}
                      >
                        {tag}
                        <button onClick={(e) => { e.stopPropagation(); removeCustomTag(tag); }} className="hover-icon-danger ml-1 rounded-md p-0.5 text-muted-foreground">
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected summary */}
            {allSelected.length > 0 && (
              <div className="pt-3 border-t border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-mono uppercase">{t("create.tags.selected", lang)}</span>
                  <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    {t("create.tags.clearAll", lang)}
                  </Button>
                </div>
                <p className="text-sm text-accent/80">
                  {allSelected.map((tag) => {
                    for (const cat of Object.values(STORY_TAGS)) {
                      const found = cat.options.find((o) => o.id === tag);
                      if (found) return found.label[lang];
                    }
                    return tag;
                  }).join(" · ")}
                </p>
              </div>
            )}
          </section>

          {/* Premise */}
          <section className="glass-panel-strong p-6 space-y-3">
            <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase">{t("create.premise.label", lang)}</label>
            <div className="relative">
              <textarea
                value={premise}
                onChange={(e) => setPremise(e.target.value)}
                placeholder={defaultPremise}
                rows={4}
                className="w-full input-game rounded-xl p-4 pr-14 text-foreground placeholder:text-muted-foreground/40 resize-y min-h-[100px] focus:outline-none font-serif"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void generatePremiseSuggestion()}
                disabled={isGenerating}
                className="absolute bottom-3 right-3 w-9 h-9 p-0 rounded-lg text-accent hover:bg-accent/10 hover:text-accent"
                title={t("create.premise.aiGenerate", lang)}
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              </Button>
            </div>
          </section>

          {/* Duration */}
          <section className="glass-panel-strong p-6 space-y-3">
            <h2 className="text-xs text-muted-foreground font-mono tracking-wider uppercase">{t("create.duration.title", lang)}</h2>
            <div className="space-y-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDuration(opt.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 ${
                    duration === opt.id
                      ? "bg-accent/15 border-accent/40 glow-accent"
                      : "hover-surface border-border/50"
                  }`}
                >
                  <span className={`text-sm ${duration === opt.id ? "text-accent" : "text-muted-foreground"}`}>
                    {duration === opt.id ? "◉ " : "○ "}
                    {opt.label[lang]}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Start */}
          <Button
            onClick={startJourney}
            size="lg"
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground py-7 text-lg btn-game glow-accent-strong disabled:opacity-30 disabled:shadow-none"
          >
            {t("create.start", lang)}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default CreateStoryPage;
