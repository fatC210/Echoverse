import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
  onNext: () => void;
  lang: "en" | "zh";
}

const WelcomeStep = ({ onNext, lang }: WelcomeStepProps) => (
  <div className="glass-panel p-8 text-center space-y-6">
    <div className="text-5xl mb-2">🎭</div>
    <h1 className="text-3xl font-bold font-serif text-gradient-primary">
      {t("onboarding.welcome.title", lang)}
    </h1>
    <p className="text-muted-foreground leading-relaxed">
      {t("onboarding.welcome.subtitle", lang)}
    </p>
    <div className="glass-panel p-4 text-sm text-muted-foreground text-left space-y-2">
      <p>🔒 {t("onboarding.welcome.privacy", lang)}</p>
      <p className="font-medium text-foreground mt-3">
        {t("onboarding.welcome.need", lang)}
      </p>
      <ul className="space-y-1 ml-2">
        <li>✦ LLM (OpenAI or compatible API)</li>
        <li>✦ ElevenLabs (voice, SFX, music)</li>
        <li>✦ turbopuffer (vector search & caching)</li>
      </ul>
    </div>
    <Button
      onClick={onNext}
      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
      size="lg"
    >
      {t("onboarding.welcome.start", lang)}
    </Button>
  </div>
);

export default WelcomeStep;
