import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettingsStore } from "@/lib/store/settings-store";
import { t } from "@/lib/i18n";
import WelcomeStep from "./WelcomeStep";
import LlmConfigStep from "./LlmConfigStep";
import ElevenLabsConfigStep from "./ElevenLabsConfigStep";
import TurbopufferConfigStep from "./TurbopufferConfigStep";
import CompletionStep from "./CompletionStep";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const OnboardingWizard = ({ onComplete }: OnboardingWizardProps) => {
  const [step, setStep] = useState(0);
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);

  const steps = [
    <WelcomeStep key="welcome" onNext={() => setStep(1)} lang={lang} />,
    <LlmConfigStep key="llm" onNext={() => setStep(2)} onBack={() => setStep(0)} lang={lang} />,
    <ElevenLabsConfigStep key="el" onNext={() => setStep(3)} onBack={() => setStep(1)} lang={lang} />,
    <TurbopufferConfigStep key="tp" onNext={() => setStep(4)} onBack={() => setStep(2)} lang={lang} />,
    <CompletionStep key="done" onComplete={onComplete} lang={lang} />,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/3 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "4s" }} />
      </div>

      {/* Progress bar */}
      {step > 0 && step < 4 && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-80">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span>{t("onboarding.step", lang)} {step}/3</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="relative z-10 w-full max-w-lg mx-4"
        >
          {steps[step]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default OnboardingWizard;
