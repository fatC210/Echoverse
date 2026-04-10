import { useState } from "react";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/lib/store/settings-store";
import { ELEVENLABS_VOICES } from "@/lib/constants/defaults";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Play, Square, Music, ArrowLeft, ArrowRight } from "lucide-react";

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
    <div className="glass-panel-strong p-8 space-y-5 scanline max-h-[85vh] overflow-y-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Music size={20} className="text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-serif">{t("onboarding.elevenlabs.title", lang)}</h2>
          <p className="text-xs text-muted-foreground">{t("onboarding.elevenlabs.hint", lang)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-1 block">
            {t("onboarding.elevenlabs.apiKey", lang)}
          </label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={elevenlabs.apiKey}
              onChange={(e) => { updateElevenlabs({ apiKey: e.target.value }); setTestStatus("idle"); }}
              className="input-game pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-accent transition-colors"
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
            disabled={!elevenlabs.apiKey || testStatus === "testing"}
            className="border-accent/30 hover:border-accent/60 hover:bg-accent/5"
          >
            {testStatus === "testing" && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {t("onboarding.testConnection", lang)}
          </Button>
          {testStatus === "success" && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 text-xs text-accent">
              <CheckCircle2 size={14} /> {t("onboarding.connected", lang)}
            </motion.span>
          )}
          {testStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <XCircle size={14} /> {t("onboarding.failed", lang)}
            </span>
          )}
        </div>

        {testStatus === "success" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="border-t border-border/30 pt-4"
          >
            <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-3 block">
              {t("onboarding.elevenlabs.selectVoice", lang)}
            </label>
            <div className="space-y-1.5 max-h-52 overflow-y-auto rounded-xl border border-border/30 bg-secondary/20 p-2">
              {ELEVENLABS_VOICES.map((v, i) => (
                <motion.button
                  key={v.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => selectVoice(v)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-sm transition-all ${
                    voice.voiceId === v.id
                      ? "bg-accent/15 border border-accent/40 glow-accent"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                      voice.voiceId === v.id ? "bg-accent status-dot" : "bg-muted-foreground/30"
                    }`} />
                    <span className="font-medium">{v.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {v.gender === "female" ? "♀" : "♂"} · {v.description[lang]}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); previewVoice(v.id); }}
                    className="h-7 px-2 text-muted-foreground hover:text-accent"
                  >
                    {playingVoice === v.id ? <Square size={12} /> : <Play size={12} />}
                  </Button>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
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

export default ElevenLabsConfigStep;
