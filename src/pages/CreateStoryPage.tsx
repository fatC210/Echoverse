import { useState, useCallback, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { STORY_TAGS, type TagCategory } from "@/lib/constants/story-tags";
import { DURATION_OPTIONS } from "@/lib/constants/defaults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, X, Loader2, ChevronDown, ChevronUp, Plus } from "lucide-react";

const CreateStoryPage = () => {
  const navigate = useNavigate();
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);

  const [premise, setPremise] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [duration, setDuration] = useState<"short" | "medium" | "long">("medium");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

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
    // Simulated loading steps
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
          <div className="absolute inset-0 bg-background" />
        </div>
        <motion.div
          className="relative z-10 text-center space-y-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Loader2 size={48} className="mx-auto text-accent animate-spin" />
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
                {loadingStep > s.step && "✅ "}
                {loadingStep === s.step && <Loader2 size={14} className="inline mr-2 animate-spin" />}
                {s.text}
              </motion.p>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft size={16} />
          </Button>
          <h1 className="text-3xl font-bold font-serif">{t("create.title", lang)}</h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Premise */}
          <section className="glass-panel p-6 space-y-3">
            <Label className="text-lg font-serif font-medium">{t("create.premise.label", lang)}</Label>
            <textarea
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              placeholder={t("create.premise.placeholder", lang)}
              rows={4}
              className="w-full bg-secondary border border-border rounded-lg p-4 text-foreground placeholder:text-muted-foreground/60 resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-accent/50 font-serif"
            />
          </section>

          {/* Tags */}
          <section className="glass-panel p-6 space-y-5">
            <h2 className="text-lg font-serif font-medium">{t("create.tags.title", lang)}</h2>

            {(Object.keys(STORY_TAGS) as TagCategory[]).map((category) => {
              const cat = STORY_TAGS[category];
              const isExpanded = expandedCategories[category];
              const visibleOptions = isExpanded ? cat.options : cat.options.slice(0, 7);

              return (
                <div key={category} className="space-y-2">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                          selectedTags.includes(option.id)
                            ? "bg-accent/20 border-accent/50 text-foreground"
                            : "border-border hover:border-muted-foreground/50 text-muted-foreground"
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
                  className="bg-secondary border-border flex-1"
                />
                <Button variant="outline" onClick={addCustomTag} disabled={!customInput.trim()}>
                  <Plus size={14} className="mr-1" /> {t("create.tags.add", lang)}
                </Button>
              </div>
              {customTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 rounded-lg text-sm bg-accent/20 border border-accent/50 text-foreground flex items-center gap-1"
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
              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{t("create.tags.selected", lang)}</span>
                  <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground">
                    {t("create.tags.clearAll", lang)}
                  </Button>
                </div>
                <p className="text-sm text-foreground">
                  {allSelected.map((tag) => {
                    // Find label for preset tags
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

          {/* Duration */}
          <section className="glass-panel p-6 space-y-3">
            <h2 className="text-lg font-serif font-medium">{t("create.duration.title", lang)}</h2>
            <div className="space-y-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDuration(opt.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    duration === opt.id
                      ? "bg-accent/20 border-accent/50"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <span className={`text-sm ${duration === opt.id ? "text-foreground" : "text-muted-foreground"}`}>
                    {duration === opt.id ? "● " : "○ "}
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
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground py-6 text-lg glow-accent"
          >
            {t("create.start", lang)}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default CreateStoryPage;
