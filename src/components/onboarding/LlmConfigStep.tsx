import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/lib/store/settings-store";
import { testLlmConnection } from "@/lib/services/llm";
import { isLlmVerified, serializeLlmVerification } from "@/lib/utils/settings-validation";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Brain, ArrowLeft, ArrowRight } from "lucide-react";

interface LlmConfigStepProps {
  onNext: () => void;
  onBack: () => void;
  lang: "en" | "zh";
}

const LlmConfigStep = ({ onNext, onBack, lang }: LlmConfigStepProps) => {
  const { llm, updateLlm } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);
  const llmVerified = isLlmVerified(llm);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">(
    llmVerified ? "success" : "idle",
  );

  const testConnection = async () => {
    setTestStatus("testing");
    try {
      await testLlmConnection(llm);
      updateLlm({ verifiedConfigSignature: serializeLlmVerification(llm) });
      setTestStatus("success");
    } catch {
      setTestStatus("error");
    }
  };

  useEffect(() => {
    if (llmVerified) {
      setTestStatus("success");
      return;
    }

    if (!llm.apiKey.trim()) {
      setTestStatus("idle");
    }
  }, [llmVerified, llm.apiKey]);

  const canProceed = llmVerified || testStatus === "success";

  const fields = [
    {
      key: "baseUrl",
      label: t("onboarding.llm.baseUrl", lang),
      value: llm.baseUrl,
      hint: t("onboarding.llm.baseUrlHint", lang),
      type: "text",
      placeholder: t("onboarding.placeholder.baseUrl", lang),
    },
    {
      key: "apiKey",
      label: t("onboarding.llm.apiKey", lang),
      value: llm.apiKey,
      type: "password",
      placeholder: t("onboarding.placeholder.apiKey", lang),
    },
    {
      key: "model",
      label: t("onboarding.llm.model", lang),
      value: llm.model,
      type: "text",
      placeholder: t("onboarding.placeholder.model", lang),
    },
    {
      key: "embeddingModel",
      label: t("onboarding.llm.embeddingModel", lang),
      value: llm.embeddingModel,
      type: "text",
      placeholder: t("onboarding.placeholder.embeddingModel", lang),
    },
  ];

  return (
    <div className="glass-panel-strong p-8 space-y-5 scanline">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Brain size={20} className="text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-serif">{t("onboarding.llm.title", lang)}</h2>
          <p className="text-xs text-muted-foreground">{t("onboarding.llm.baseUrlHint", lang)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {fields.map((field, i) => (
          <motion.div
            key={field.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-1 block">{field.label}</label>
            <div className="relative">
              <Input
                type={field.key === "apiKey" ? (showKey ? "text" : "password") : "text"}
                placeholder={field.placeholder}
                value={field.value}
                onChange={(e) => { updateLlm({ [field.key]: e.target.value }); setTestStatus("idle"); }}
                className={field.key === "apiKey" ? "input-game pr-10" : "input-game"}
              />
              {field.key === "apiKey" && (
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  onMouseDown={(event) => event.preventDefault()}
                  className="hover-icon-accent absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
            </div>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-3 pt-1"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={testConnection}
            disabled={!llm.apiKey || testStatus === "testing"}
            className="border-accent/30 hover:border-accent/60 hover:bg-accent/5"
          >
            {testStatus === "testing" && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {t("onboarding.testConnection", lang)}
          </Button>
          {testStatus === "success" && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 text-xs text-accent"
            >
              <CheckCircle2 size={14} /> {t("onboarding.connected", lang)}
            </motion.span>
          )}
          {testStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <XCircle size={14} /> {t("onboarding.failed", lang)}
            </span>
          )}
        </motion.div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} className="mr-1" />{t("onboarding.back", lang)}
        </Button>
        <Button
          onClick={onNext}
          disabled={!canProceed}
          className="bg-accent hover:bg-accent/90 text-accent-foreground btn-game glow-accent disabled:opacity-30 disabled:shadow-none"
        >
          {t("onboarding.next", lang)}<ArrowRight size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default LlmConfigStep;
