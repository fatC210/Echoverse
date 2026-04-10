import { useState, useCallback, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { STORY_TAGS, type TagCategory } from "@/lib/constants/story-tags";
import { DURATION_OPTIONS } from "@/lib/constants/defaults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, X, Loader2, ChevronDown, ChevronUp, Plus, Headphones, Wand2 } from "lucide-react";
import { toast } from "sonner";

const CreateStoryPage = () => {
  const navigate = useNavigate();
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);
  const llmConfig = useSettingsStore((s) => s.llm);

  const [premise, setPremise] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [duration, setDuration] = useState<"short" | "medium" | "long">("medium");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const addCustomTag = useCallback(() => {
    const tag = customInput.trim();
    if (tag && !customTags.includes(tag)) {
      setCustomTags((prev) => [...prev, tag]);
      setCustomInput("");
    }
  }, [customInput, customTags]);

  const removeCustomTag = (tag: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); addCustomTag(); }
  };

  const clearAll = () => {
    setSelectedTags([]);
    setCustomTags([]);
  };

  const allSelected = [...selectedTags, ...customTags];

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const startJourney = async () => {
    setIsLoading(true);
    setLoadingStep(1);
    setTimeout(() => setLoadingStep(2), 3000);
    setTimeout(() => {
      setLoadingStep(3);
      setTimeout(() => {
        const storyId = `story_${Date.now()}`;
        navigate(`/play/${storyId}`);
      }, 1500);
    }, 6000);
  };

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
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <div className="absolute inset-3 rounded-full border border-accent/30 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
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
    <div className="min-h-screen bg-background relative">
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
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} />
          </Button>
          <h1 className="text-2xl font-bold font-serif text-accent">{t("create.title", lang)}</h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Tags */}
          <section className="glass-panel-strong p-6 space-y-5">
            <h2 className="text-xs text-muted-foreground font-mono tracking-wider uppercase">{t("create.tags.title", lang)}</h2>

            {(Object.keys(STORY_TAGS) as TagCategory[]).map((category) => {
              const cat = STORY_TAGS[category];
              const isExpanded = expandedCategories[category];
              const visibleOptions = isExpanded ? cat.options : cat.options.slice(0, 7);

              return (
                <div key={category} className="space-y-2">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-accent transition-colors"
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label[lang]}</span>
                    {cat.options.length > 7 && (
                      isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {visibleOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => toggleTag(option.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all duration-200 ${
                          selectedTags.includes(option.id)
                            ? "bg-accent/15 border-accent/40 text-accent glow-accent"
                            : "border-border/50 hover:border-accent/30 text-muted-foreground hover:text-foreground"
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
                ✏️ {t("create.tags.custom", lang)}
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
                  {customTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 rounded-lg text-sm bg-accent/15 border border-accent/40 text-accent flex items-center gap-1"
                    >
                      {tag}
                      <button onClick={() => removeCustomTag(tag)} className="ml-1 hover:text-destructive">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Selected summary */}
            {allSelected.length > 0 && (
              <div className="pt-3 border-t border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-mono uppercase">{t("create.tags.selected", lang)}</span>
                  <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground hover:text-destructive">
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
                placeholder={t("create.premise.placeholder", lang)}
                rows={4}
                className="w-full input-game rounded-xl p-4 pr-14 text-foreground placeholder:text-muted-foreground/40 resize-y min-h-[100px] focus:outline-none font-serif"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!llmConfig.apiKey) {
                    toast.error(t("create.premise.noApiKey", lang));
                    return;
                  }
                  setIsGenerating(true);
                  try {
                    // Build tag context from selected elements
                    const tagLabels = allSelected.map((tag) => {
                      for (const cat of Object.values(STORY_TAGS)) {
                        const found = cat.options.find((o) => o.id === tag);
                        if (found) return found.label[lang];
                      }
                      return tag;
                    });
                    const hasElements = tagLabels.length > 0;
                    const elementsStr = tagLabels.join(", ");

                    const systemPrompt = lang === "zh"
                      ? `你是一个顶级悬念故事构思大师。你的任务是生成一个故事前提。

要求：
- 2-3句话，简洁有力
- 必须有伏笔或悬念，让人想知道接下来会发生什么
- 用省略号或暗示性结尾制造悬念感
- 参考风格："一个宇航员在废弃空间站上独自醒来。她需要修复通讯系统才能呼叫救援，但空间站里似乎还有其他东西..."
${hasElements ? `- 必须自然融入以下元素：${elementsStr}` : "- 随机选择一个类型：科幻、奇幻、悬疑、冒险、恐怖、都市、历史等"}

输出格式：直接输出前提内容，不要加标题、前缀、引号、编号或任何解释。`
                      : `You are a master story premise creator specializing in suspense and intrigue.

Requirements:
- 2-3 sentences, concise and gripping
- Must contain foreshadowing or suspense that makes the reader want to know what happens next
- End with an ellipsis or suggestive hint to create tension
- Reference style: "An astronaut wakes up alone on an abandoned space station. She needs to repair the communications system to call for rescue, but something else seems to be on the station..."
${hasElements ? `- Must naturally incorporate these elements: ${elementsStr}` : "- Randomly choose a genre: sci-fi, fantasy, mystery, adventure, horror, urban, historical, etc."}

Output format: Output ONLY the premise text. No titles, prefixes, quotes, numbering, or explanations.`;
                    const res = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${llmConfig.apiKey}`,
                      },
                      body: JSON.stringify({
                        model: llmConfig.model,
                        messages: [
                          { role: "system", content: systemPrompt },
                          { role: "user", content: lang === "zh" ? "生成" : "Generate" },
                        ],
                        max_tokens: 200,
                        temperature: 1.0,
                      }),
                    });
                    if (!res.ok) throw new Error("API error");
                    const data = await res.json();
                    const raw = data.choices?.[0]?.message?.content?.trim() || "";
                    // Extract only the premise: strip prefixes, quotes, numbering, markdown
                    const text = raw
                      .replace(/^(#{1,3}\s+)?/gm, "")
                      .replace(/^(story premise|故事前提|premise|前提)[：:]\s*/i, "")
                      .replace(/^\*{1,2}(.*?)\*{1,2}$/gm, "$1")
                      .replace(/^["「『"""'']|["」』"""'']$/g, "")
                      .replace(/^\d+[.)]\s*/, "")
                      .trim();
                    if (text) setPremise(text);
                  } catch {
                    toast.error(t("create.premise.genFailed", lang));
                  } finally {
                    setIsGenerating(false);
                  }
                }}
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
                      : "border-border/50 hover:border-accent/30"
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
            disabled={!premise.trim()}
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
