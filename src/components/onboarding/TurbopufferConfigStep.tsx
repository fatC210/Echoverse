import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/lib/store/settings-store";
import { testTurbopufferConnection } from "@/lib/services/turbopuffer";
import {
  isTurbopufferVerified,
  serializeTurbopufferVerification,
} from "@/lib/utils/settings-validation";
import { Eye, EyeOff, Zap, ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface TurbopufferConfigStepProps {
  onNext: () => void;
  onBack: () => void;
  lang: "en" | "zh";
}

const TurbopufferConfigStep = ({ onNext, onBack, lang }: TurbopufferConfigStepProps) => {
  const { turbopuffer, updateTurbopuffer } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);
  const turbopufferVerified = isTurbopufferVerified(turbopuffer);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">(
    turbopufferVerified ? "success" : "idle",
  );

  const testConnection = async () => {
    setTestStatus("testing");
    try {
      await testTurbopufferConnection(turbopuffer);
      updateTurbopuffer({
        verifiedConfigSignature: serializeTurbopufferVerification(turbopuffer),
      });
      setTestStatus("success");
    } catch {
      setTestStatus("error");
    }
  };

  useEffect(() => {
    if (turbopufferVerified) {
      setTestStatus("success");
      return;
    }

    if (!turbopuffer.apiKey.trim()) {
      setTestStatus("idle");
    }
  }, [turbopufferVerified, turbopuffer.apiKey]);

  const canProceed = turbopufferVerified || testStatus === "success";

  return (
    <div className="glass-panel-strong p-8 space-y-5 scanline">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Zap size={20} className="text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-serif">{t("onboarding.turbopuffer.title", lang)}</h2>
          <p className="text-xs text-muted-foreground">{t("onboarding.turbopuffer.hint", lang)}</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div>
          <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-1 block">
            {t("onboarding.turbopuffer.apiKey", lang)}
          </label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              placeholder={t("onboarding.placeholder.apiKey", lang)}
              value={turbopuffer.apiKey}
              onChange={(e) => {
                updateTurbopuffer({ apiKey: e.target.value });
                setTestStatus("idle");
              }}
              className="input-game pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              onMouseDown={(event) => event.preventDefault()}
              className="hover-icon-accent absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={testConnection}
            disabled={!turbopuffer.apiKey.trim() || testStatus === "testing"}
            className="border-accent/30 hover:border-accent/60 hover:bg-accent/5"
          >
            {testStatus === "testing" && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {t("onboarding.testConnection", lang)}
          </Button>
          {testStatus === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 text-xs text-accent"
            >
              <CheckCircle size={14} />
              <span>{t("onboarding.turbopuffer.ready", lang)}</span>
            </motion.div>
          )}
          {testStatus === "error" && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <XCircle size={14} />
              <span>{t("onboarding.failed", lang)}</span>
            </div>
          )}
        </div>
      </motion.div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} className="mr-1" />{t("onboarding.back", lang)}
        </Button>
        <Button
          onClick={onNext}
          disabled={!canProceed}
          className="bg-accent hover:bg-accent/90 text-accent-foreground btn-game glow-accent disabled:opacity-30 disabled:shadow-none"
        >
          {t("onboarding.finish", lang)}<CheckCircle size={14} className="ml-1.5" />
        </Button>
      </div>
    </div>
  );
};

export default TurbopufferConfigStep;
