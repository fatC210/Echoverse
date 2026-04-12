import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/store/settings-store";
import { getLocalizedVoiceName } from "@/lib/utils/voices";
import { CheckCircle2, Headphones, Brain, Music, Zap, Mic } from "lucide-react";

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

  const items = [
    { icon: <Brain size={16} />, label: lang === "zh" ? "LLM 服务" : "LLM Service", status: true },
    { icon: <Music size={16} />, label: "ElevenLabs", status: true },
    { icon: <Zap size={16} />, label: "turbopuffer", status: true },
    { icon: <Mic size={16} />, label: `${lang === "zh" ? "旁白声音" : "Voice"}: ${getLocalizedVoiceName(voice.voiceId, voice.voiceName, lang)}`, status: !!voice.voiceId },
  ];

  return (
    <div className="glass-panel-strong p-8 text-center space-y-6 scanline">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.6, ease: "backOut" }}
        className="relative inline-block"
      >
        <div className="w-20 h-20 mx-auto rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center glow-accent-strong">
          <CheckCircle2 size={36} className="text-accent" />
        </div>
      </motion.div>

      <h1 className="text-3xl font-bold font-serif text-gradient-primary">
        {t("onboarding.complete.title", lang)}
      </h1>

      <div className="space-y-2">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30"
          >
            <span className="text-accent">{item.icon}</span>
            <span className="flex-1 text-sm text-left">{item.label}</span>
            <div className={`w-2 h-2 rounded-full ${item.status ? 'bg-accent status-dot' : 'bg-muted-foreground'}`} />
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("onboarding.complete.saved", lang)}<br />
        {t("onboarding.complete.modify", lang)}
      </p>

      <Button
        onClick={handleComplete}
        size="lg"
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground btn-game glow-accent-strong"
      >
        <Headphones size={18} className="mr-2" />
        {t("onboarding.complete.cta", lang)}
      </Button>
    </div>
  );
};

export default CompletionStep;
