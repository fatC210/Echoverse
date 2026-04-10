import { useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/lib/store/settings-store";
import { ELEVENLABS_VOICES } from "@/lib/constants/defaults";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Play, Square } from "lucide-react";

interface ElevenLabsConfigStepProps {
  onNext: () => void;
  onBack: () => void;
  lang: "en" | "zh";
}

const ElevenLabsConfigStep = ({ onNext, onBack, lang }: ElevenLabsConfigStepProps) => {
  const { elevenlabs, voice, updateElevenlabs, updateVoice } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  const testConnection = async () => {
    setTestStatus("testing");
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": elevenlabs.apiKey },
      });
      setTestStatus(res.ok ? "success" : "error");
    } catch {
      setTestStatus("error");
    }
  };

  const selectVoice = (v: typeof ELEVENLABS_VOICES[0]) => {
    updateVoice({
      voiceId: v.id,
      voiceName: v.name,
      voiceDescription: `${v.gender === "female" ? "♀" : "♂"} ${v.description[lang]}`,
    });
  };

  const previewVoice = async (voiceId: string) => {
    if (playingVoice) { setPlayingVoice(null); return; }
    setPlayingVoice(voiceId);
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": elevenlabs.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "The sun slowly sank behind the distant hills, casting long shadows across the valley.",
          model_id: "eleven_multilingual_v2",
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
        await audio.play();
      }
    } catch {}
    setTimeout(() => setPlayingVoice(null), 10000);
  };

  const hasVoice = !!voice.voiceId;
  const canProceed = testStatus === "success" && hasVoice;

  return (
    <div className="glass-panel p-8 space-y-5 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🎵</span>
        <h2 className="text-2xl font-bold font-serif">{t("onboarding.elevenlabs.title", lang)}</h2>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm text-muted-foreground">{t("onboarding.elevenlabs.apiKey", lang)}</Label>
          <div className="relative mt-1">
            <Input
              type={showKey ? "text" : "password"}
              value={elevenlabs.apiKey}
              onChange={(e) => { updateElevenlabs({ apiKey: e.target.value }); setTestStatus("idle"); }}
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
          <p className="text-xs text-muted-foreground mt-1">💡 {t("onboarding.elevenlabs.hint", lang)}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={testConnection} disabled={!elevenlabs.apiKey || testStatus === "testing"}>
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

        {testStatus === "success" && (
          <div className="border-t border-border pt-4">
            <Label className="text-sm font-medium">{t("onboarding.elevenlabs.selectVoice", lang)}</Label>
            <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-secondary/50 p-2 mt-2">
              {ELEVENLABS_VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => selectVoice(v)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-sm transition-colors ${
                    voice.voiceId === v.id
                      ? "bg-accent/20 border border-accent/50"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full border-2 ${
                      voice.voiceId === v.id ? "bg-accent border-accent" : "border-muted-foreground"
                    }`} />
                    <span className="font-medium">{v.name}</span>
                    <span className="text-muted-foreground">
                      · {v.gender === "female" ? "♀" : "♂"} · {v.description[lang]}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); previewVoice(v.id); }}
                    className="h-7 px-2"
                  >
                    {playingVoice === v.id ? <Square size={12} /> : <Play size={12} />}
                    <span className="ml-1 text-xs">
                      {playingVoice === v.id ? "Stop" : lang === "zh" ? "试听" : "Preview"}
                    </span>
                  </Button>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>{t("onboarding.back", lang)}</Button>
        <Button onClick={onNext} disabled={!canProceed} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          {t("onboarding.next", lang)}
        </Button>
      </div>
    </div>
  );
};

export default ElevenLabsConfigStep;
