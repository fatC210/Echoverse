import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/store/settings-store";
import { CheckCircle2 } from "lucide-react";

interface CompletionStepProps {
  onComplete: () => void;
  lang: "en" | "zh";
}

const CompletionStep = ({ onComplete, lang }: CompletionStepProps) => {
  const { voice, setOnboardingCompleted } = useSettingsStore();

  const handleComplete = () => {
    setOnboardingCompleted(true);
    onComplete();
  };

  return (
    <div className="glass-panel p-8 text-center space-y-6">
      <div className="text-5xl mb-2">✅</div>
      <h1 className="text-3xl font-bold font-serif text-gradient-primary">
        {t("onboarding.complete.title", lang)}
      </h1>

      <div className="space-y-3 text-left">
        {[
          { icon: "🧠", label: "LLM Service", status: true },
          { icon: "🎵", label: "ElevenLabs", status: true },
          { icon: "🔍", label: "turbopuffer", status: true },
          { icon: "🗣", label: `Narration Voice: ${voice.voiceName || "—"}`, status: !!voice.voiceId },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
            <span>{item.icon}</span>
            <span className="flex-1 text-sm">{item.label}</span>
            <CheckCircle2 size={18} className={item.status ? "text-emerald-400" : "text-muted-foreground"} />
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {t("onboarding.complete.saved", lang)}<br />
        {t("onboarding.complete.modify", lang)}
      </p>

      <Button
        onClick={handleComplete}
        className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground"
        size="lg"
      >
        {t("onboarding.complete.cta", lang)}
      </Button>
    </div>
  );
};

export default CompletionStep;
