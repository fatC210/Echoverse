import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ELEVENLABS_VOICES } from "@/lib/constants/defaults";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, ArrowLeft, Trash2, Play, Square, Brain, Music, Zap } from "lucide-react";

const SettingsPage = () => {
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const lang = settings.preferences.interfaceLang;

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testStatuses, setTestStatuses] = useState<Record<string, "idle" | "testing" | "success" | "error">>({});
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  const toggleKey = (key: string) => setShowKeys((p) => ({ ...p, [key]: !p[key] }));

  const testLlm = async () => {
    setTestStatuses((p) => ({ ...p, llm: "testing" }));
    try {
      const res = await fetch(`${settings.llm.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${settings.llm.apiKey}` },
      });
      setTestStatuses((p) => ({ ...p, llm: res.ok ? "success" : "error" }));
    } catch { setTestStatuses((p) => ({ ...p, llm: "error" })); }
  };

  const testElevenlabs = async () => {
    setTestStatuses((p) => ({ ...p, el: "testing" }));
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": settings.elevenlabs.apiKey },
      });
      setTestStatuses((p) => ({ ...p, el: res.ok ? "success" : "error" }));
    } catch { setTestStatuses((p) => ({ ...p, el: "error" })); }
  };

  const previewVoice = async (voiceId: string) => {
    if (playingVoice) { setPlayingVoice(null); return; }
    setPlayingVoice(voiceId);
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": settings.elevenlabs.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text: "The sun slowly sank behind the distant hills.", model_id: "eleven_multilingual_v2" }),
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

  const clearAll = () => {
    if (window.confirm(t("settings.clearConfirm", lang))) {
      settings.clearAll();
      navigate("/");
    }
  };

  const TestButton = ({ status, onTest }: { status: string; onTest: () => void }) => (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onTest} disabled={status === "testing"} className="border-accent/30 hover:border-accent/60 hover:bg-accent/5">
        {status === "testing" && <Loader2 size={14} className="mr-1 animate-spin" />}
        {t("onboarding.testConnection", lang)}
      </Button>
      {status === "success" && <span className="flex items-center gap-1 text-xs text-accent"><CheckCircle2 size={14} /></span>}
      {status === "error" && <span className="flex items-center gap-1 text-xs text-destructive"><XCircle size={14} /></span>}
    </div>
  );

  const KeyInput = ({ label, value, onChange, id }: { label: string; value: string; onChange: (v: string) => void; id: string }) => (
    <div>
      <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-1 block">{label}</label>
      <div className="relative">
        <Input
          type={showKeys[id] ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-game pr-10"
        />
        <button type="button" onClick={() => toggleKey(id)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-accent transition-colors">
          {showKeys[id] ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--accent)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--accent)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} />
          </Button>
          <h1 className="text-2xl font-bold font-serif text-accent">{t("settings.title", lang)}</h1>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* LLM */}
          <section className="glass-panel-strong p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Brain size={16} className="text-accent" />
              </div>
              <h2 className="text-lg font-semibold font-serif">LLM</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-1 block">{t("onboarding.llm.baseUrl", lang)}</label>
                <Input value={settings.llm.baseUrl} onChange={(e) => settings.updateLlm({ baseUrl: e.target.value })} className="input-game" />
              </div>
              <KeyInput label={t("onboarding.llm.apiKey", lang)} value={settings.llm.apiKey} onChange={(v) => settings.updateLlm({ apiKey: v })} id="llm" />
              <div>
                <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-1 block">{t("onboarding.llm.model", lang)}</label>
                <Input value={settings.llm.model} onChange={(e) => settings.updateLlm({ model: e.target.value })} className="input-game" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-1 block">{t("onboarding.llm.embeddingModel", lang)}</label>
                <Input value={settings.llm.embeddingModel} onChange={(e) => settings.updateLlm({ embeddingModel: e.target.value })} className="input-game" />
              </div>
              <TestButton status={testStatuses.llm || "idle"} onTest={testLlm} />
            </div>
          </section>

          {/* ElevenLabs */}
          <section className="glass-panel-strong p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Music size={16} className="text-accent" />
              </div>
              <h2 className="text-lg font-semibold font-serif">ElevenLabs</h2>
            </div>
            <KeyInput label={t("onboarding.elevenlabs.apiKey", lang)} value={settings.elevenlabs.apiKey} onChange={(v) => settings.updateElevenlabs({ apiKey: v })} id="el" />
            <TestButton status={testStatuses.el || "idle"} onTest={testElevenlabs} />
          </section>

          {/* turbopuffer */}
          <section className="glass-panel-strong p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Zap size={16} className="text-accent" />
              </div>
              <h2 className="text-lg font-semibold font-serif">turbopuffer</h2>
            </div>
            <KeyInput label={t("onboarding.turbopuffer.apiKey", lang)} value={settings.turbopuffer.apiKey} onChange={(v) => settings.updateTurbopuffer({ apiKey: v })} id="tp" />
          </section>

          {/* Voice - Grid layout */}
          <section className="glass-panel-strong p-6 space-y-4">
            <h2 className="text-lg font-semibold font-serif">{t("settings.voiceSettings", lang)}</h2>
            <div className="grid grid-cols-4 gap-2">
              {ELEVENLABS_VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => settings.updateVoice({ voiceId: v.id, voiceName: v.name, voiceDescription: `${v.gender === "female" ? "♀" : "♂"} ${v.description[lang]}` })}
                  className={`relative flex flex-col items-center p-3 rounded-xl text-sm transition-all ${
                    settings.voice.voiceId === v.id
                      ? "bg-accent/15 border border-accent/40 glow-accent"
                      : "hover:bg-muted/50 border border-border/30"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs mb-1.5 ${
                    settings.voice.voiceId === v.id ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                  }`}>
                    {v.gender === "female" ? "♀" : "♂"}
                  </div>
                  <span className="font-medium text-xs">{v.name}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 text-center leading-tight">{v.description[lang]}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); previewVoice(v.id); }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-muted/50 hover:bg-accent/20 flex items-center justify-center text-muted-foreground hover:text-accent transition-colors"
                  >
                    {playingVoice === v.id ? <Square size={8} /> : <Play size={8} />}
                  </button>
                  {settings.voice.voiceId === v.id && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent status-dot" />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Preferences */}
          <section className="glass-panel-strong p-6 space-y-4">
            <h2 className="text-lg font-semibold font-serif">{t("settings.preferences", lang)}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-2 block">{t("settings.interfaceLang", lang)}</label>
                <div className="flex gap-2">
                  {(["en", "zh"] as const).map((l) => (
                    <Button key={l} variant={settings.preferences.interfaceLang === l ? "default" : "outline"} size="sm"
                      onClick={() => settings.updatePreferences({ interfaceLang: l })}
                      className={settings.preferences.interfaceLang === l ? "bg-accent text-accent-foreground" : "border-accent/30 hover:border-accent/60"}>
                      {l === "en" ? "EN" : "中文"}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-2 block">{t("settings.storyLang", lang)}</label>
                <div className="flex gap-2">
                  {(["en", "zh"] as const).map((l) => (
                    <Button key={l} variant={settings.preferences.storyLang === l ? "default" : "outline"} size="sm"
                      onClick={() => settings.updatePreferences({ storyLang: l })}
                      className={settings.preferences.storyLang === l ? "bg-accent text-accent-foreground" : "border-accent/30 hover:border-accent/60"}>
                      {l === "en" ? "EN" : "中文"}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-2 block">{t("settings.audioQuality", lang)}</label>
                <div className="flex gap-2">
                  {(["standard", "high"] as const).map((q) => (
                    <Button key={q} variant={settings.preferences.audioQuality === q ? "default" : "outline"} size="sm"
                      onClick={() => settings.updatePreferences({ audioQuality: q })}
                      className={settings.preferences.audioQuality === q ? "bg-accent text-accent-foreground" : "border-accent/30 hover:border-accent/60"}>
                      {t(`settings.${q}`, lang)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Danger */}
          <section className="glass-panel-strong p-6 border-destructive/20">
            <Button variant="destructive" onClick={clearAll} className="w-full">
              <Trash2 size={16} className="mr-2" />
              {t("settings.clearAll", lang)}
            </Button>
          </section>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsPage;
