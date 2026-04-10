import { useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface TurbopufferConfigStepProps {
  onNext: () => void;
  onBack: () => void;
  lang: "en" | "zh";
}

const TurbopufferConfigStep = ({ onNext, onBack, lang }: TurbopufferConfigStepProps) => {
  const { turbopuffer, updateTurbopuffer } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  const testConnection = async () => {
    setTestStatus("testing");
    try {
      const res = await fetch(`${turbopuffer.baseUrl}/v1/vectors`, {
        headers: { Authorization: `Bearer ${turbopuffer.apiKey}` },
      });
      setTestStatus(res.ok ? "success" : "error");
    } catch {
      setTestStatus("error");
    }
  };

  const canProceed = testStatus === "success";

  return (
    <div className="glass-panel p-8 space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🔍</span>
        <h2 className="text-2xl font-bold font-serif">{t("onboarding.turbopuffer.title", lang)}</h2>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm text-muted-foreground">{t("onboarding.turbopuffer.apiKey", lang)}</Label>
          <div className="relative mt-1">
            <Input
              type={showKey ? "text" : "password"}
              value={turbopuffer.apiKey}
              onChange={(e) => { updateTurbopuffer({ apiKey: e.target.value }); setTestStatus("idle"); }}
              className="bg-secondary border-border pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">💡 {t("onboarding.turbopuffer.hint", lang)}</p>
        </div>

        <div>
          <Label className="text-sm text-muted-foreground">{t("onboarding.turbopuffer.baseUrl", lang)}</Label>
          <Input
            value={turbopuffer.baseUrl}
            onChange={(e) => updateTurbopuffer({ baseUrl: e.target.value })}
            className="bg-secondary border-border mt-1"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={testConnection} disabled={!turbopuffer.apiKey || testStatus === "testing"}>
            {testStatus === "testing" && <Loader2 size={14} className="mr-1 animate-spin" />}
            {t("onboarding.testConnection", lang)}
          </Button>
          {testStatus === "success" && (
            <span className="flex items-center gap-1 text-sm text-emerald-400">
              <CheckCircle2 size={16} /> {t("onboarding.connected", lang)}
            </span>
          )}
          {testStatus === "error" && (
            <span className="flex items-center gap-1 text-sm text-destructive">
              <XCircle size={16} /> {t("onboarding.failed", lang)}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>{t("onboarding.back", lang)}</Button>
        <Button onClick={onNext} disabled={!canProceed} className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
          {t("onboarding.finish", lang)}
        </Button>
      </div>
    </div>
  );
};

export default TurbopufferConfigStep;
