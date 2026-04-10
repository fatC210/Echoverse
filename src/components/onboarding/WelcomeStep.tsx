import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Headphones, Shield, Brain, Music, Zap } from "lucide-react";

interface WelcomeStepProps {
  onNext: () => void;
  lang: "en" | "zh";
}

const WelcomeStep = ({ onNext, lang }: WelcomeStepProps) => (
  <div className="glass-panel-strong p-8 text-center space-y-6 scanline">
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: "backOut" }}
      className="relative inline-block"
    >
      <div className="w-20 h-20 mx-auto rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center glow-accent">
        <Headphones size={36} className="text-accent" />
      </div>
      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent/60 animate-pulse" />
    </motion.div>

    <div>
      <h1 className="text-3xl font-bold font-serif text-gradient-primary mb-2">
        {t("onboarding.welcome.title", lang)}
      </h1>
      <p className="text-muted-foreground leading-relaxed text-sm">
        {t("onboarding.welcome.subtitle", lang)}
      </p>
    </div>

    <div className="flex items-center gap-2 justify-center text-xs text-accent/70">
      <Shield size={12} />
      <span>{t("onboarding.welcome.privacy", lang)}</span>
    </div>

    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        {t("onboarding.welcome.need", lang)}
      </p>
      {[
        { icon: <Brain size={16} />, text: "LLM (OpenAI or compatible API)", delay: 0.1 },
        { icon: <Music size={16} />, text: "ElevenLabs (voice, SFX, music)", delay: 0.2 },
        { icon: <Zap size={16} />, text: "turbopuffer (vector search & caching)", delay: 0.3 },
      ].map((item) => (
        <motion.div
          key={item.text}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: item.delay + 0.3 }}
          className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border/30 text-sm text-foreground/80"
        >
          <span className="text-accent">{item.icon}</span>
          <span>{item.text}</span>
        </motion.div>
      ))}
    </div>

    <Button
      onClick={onNext}
      size="lg"
      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground btn-game glow-accent"
    >
      {t("onboarding.welcome.start", lang)}
    </Button>
  </div>
);

export default WelcomeStep;
