import { useEffect, useState } from "react";
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

const FloatingParticle = ({ delay, x, size }: { delay: number; x: number; size: number }) => (
  <div
    className="absolute rounded-full bg-accent/30 animate-float-up"
    style={{
      left: `${x}%`,
      width: `${size}px`,
      height: `${size}px`,
      animationDelay: `${delay}s`,
      animationDuration: `${12 + Math.random() * 8}s`,
    }}
  />
);

const OnboardingWizard = ({ onComplete }: OnboardingWizardProps) => {
  const [step, setStep] = useState(0);
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const steps = [
    <WelcomeStep key="welcome" onNext={() => setStep(1)} lang={lang} />,
    <LlmConfigStep key="llm" onNext={() => setStep(2)} onBack={() => setStep(0)} lang={lang} />,
    <ElevenLabsConfigStep key="el" onNext={() => setStep(3)} onBack={() => setStep(1)} lang={lang} />,
    <TurbopufferConfigStep key="tp" onNext={() => setStep(4)} onBack={() => setStep(2)} lang={lang} />,
    <CompletionStep key="done" onComplete={onComplete} lang={lang} />,
  ];

  const particles = Array.from({ length: 20 }, (_, i) => ({
    delay: i * 1.2,
    x: Math.random() * 100,
    size: 2 + Math.random() * 4,
  }));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background">
      <div className="relative flex min-h-full items-start justify-center px-4 py-20 sm:px-6 sm:py-24">
        {/* Ambient background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-background" />
          {/* Orbiting glow */}
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2">
            <div className="absolute inset-0 rounded-full bg-accent/5 animate-glow-pulse" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/40 animate-orbit" />
            <div
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/30 animate-orbit"
              style={{ animationDuration: "15s", animationDirection: "reverse" }}
            />
          </div>
          {/* Floating particles */}
          <div className="particle-field">
            {particles.map((p, i) => (
              <FloatingParticle key={i} {...p} />
            ))}
          </div>
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--accent)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--accent)) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Progress bar */}
        {step > 0 && step < 4 && (
          <div className="pointer-events-none fixed inset-x-0 top-8 z-20 flex justify-center px-4">
            <div className="w-full max-w-[20rem]">
              <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
                <span className="font-mono text-xs uppercase tracking-widest">
                  {t("onboarding.step", lang)} {step}/3
                </span>
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((s) => (
                    <div
                      key={s}
                      className={`h-2 w-2 rounded-full transition-all duration-500 ${
                        s <= step ? "bg-accent status-dot" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="h-[2px] overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${(step / 3) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  style={{ boxShadow: "0 0 10px hsl(var(--accent) / 0.5)" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative z-10 w-full max-w-lg"
          >
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OnboardingWizard;
