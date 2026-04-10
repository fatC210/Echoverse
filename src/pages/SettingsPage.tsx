import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ELEVENLABS_VOICES } from "@/lib/constants/defaults";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, ArrowLeft, Trash2, Play, Square } from "lucide-react";

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

  // turbopuffer API doesn't support CORS, skip browser-side test


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
      <Button variant="outline" size="sm" onClick={onTest} disabled={status === "testing"}>
        {status === "testing" && <Loader2 size={14} className="mr-1 animate-spin" />}
        {t("onboarding.testConnection", lang)}
      </Button>
      {status === "success" && <CheckCircle2 size={16} className="text-emerald-400" />}
      {status === "error" && <XCircle size={16} className="text-destructive" />}
    </div>
  );

  const KeyInput = ({ label, value, onChange, id }: { label: string; value: string; onChange: (v: string) => void; id: string }) => (
    <div>
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="relative mt-1">
        <Input
          type={showKeys[id] ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-secondary border-border pr-10"
        />
        <button type="button" onClick={() => toggleKey(id)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {showKeys[id] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft size={16} /></Button>
          <h1 className="text-3xl font-bold font-serif">{t("settings.title", lang)}</h1>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* API Keys */}
          <section className="glass-panel p-6 space-y-6">
            <h2 className="text-xl font-semibold font-serif">{t("settings.apiKeys", lang)}</h2>

            {/* LLM */}
            <div className="space-y-3 pb-4 border-b border-border">
              <h3 className="text-sm font-medium flex items-center gap-2">🧠 LLM</h3>
              <div>
                <Label className="text-sm text-muted-foreground">{t("onboarding.llm.baseUrl", lang)}</Label>
                <Input value={settings.llm.baseUrl} onChange={(e) => settings.updateLlm({ baseUrl: e.target.value })} className="bg-secondary border-border mt-1" />
              </div>
              <KeyInput label={t("onboarding.llm.apiKey", lang)} value={settings.llm.apiKey} onChange={(v) => settings.updateLlm({ apiKey: v })} id="llm" />
              <div>
                <Label className="text-sm text-muted-foreground">{t("onboarding.llm.model", lang)}</Label>
                <Input value={settings.llm.model} onChange={(e) => settings.updateLlm({ model: e.target.value })} className="bg-secondary border-border mt-1" />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">{t("onboarding.llm.embeddingModel", lang)}</Label>
                <Input value={settings.llm.embeddingModel} onChange={(e) => settings.updateLlm({ embeddingModel: e.target.value })} className="bg-secondary border-border mt-1" />
              </div>
              <TestButton status={testStatuses.llm || "idle"} onTest={testLlm} />
            </div>

            {/* ElevenLabs */}
            <div className="space-y-3 pb-4 border-b border-border">
              <h3 className="text-sm font-medium flex items-center gap-2">🎵 ElevenLabs</h3>
              <KeyInput label={t("onboarding.elevenlabs.apiKey", lang)} value={settings.elevenlabs.apiKey} onChange={(v) => settings.updateElevenlabs({ apiKey: v })} id="el" />
              <TestButton status={testStatuses.el || "idle"} onTest={testElevenlabs} />
            </div>

            {/* turbopuffer */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">🔍 turbopuffer</h3>
              <KeyInput label={t("onboarding.turbopuffer.apiKey", lang)} value={settings.turbopuffer.apiKey} onChange={(v) => settings.updateTurbopuffer({ apiKey: v })} id="tp" />
              <TestButton status={testStatuses.tp || "idle"} onTest={testTurbopuffer} />
            </div>
          </section>

          {/* Voice */}
          <section className="glass-panel p-6 space-y-4">
            <h2 className="text-xl font-semibold font-serif">{t("settings.voiceSettings", lang)}</h2>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <span>🗣</span>
              <span className="flex-1">{settings.voice.voiceName || "Not selected"} — {settings.voice.voiceDescription}</span>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {ELEVENLABS_VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => settings.updateVoice({ voiceId: v.id, voiceName: v.name, voiceDescription: `${v.gender === "female" ? "♀" : "♂"} ${v.description[lang]}` })}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-sm transition-colors ${settings.voice.voiceId === v.id ? "bg-accent/20 border border-accent/50" : "hover:bg-muted"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full border-2 ${settings.voice.voiceId === v.id ? "bg-accent border-accent" : "border-muted-foreground"}`} />
                    <span>{v.name}</span>
                    <span className="text-muted-foreground text-xs">{v.description[lang]}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); previewVoice(v.id); }} className="h-7 px-2">
                    {playingVoice === v.id ? <Square size={12} /> : <Play size={12} />}
                  </Button>
                </button>
              ))}
            </div>
          </section>

          {/* Preferences */}
          <section className="glass-panel p-6 space-y-4">
            <h2 className="text-xl font-semibold font-serif">{t("settings.preferences", lang)}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">{t("settings.interfaceLang", lang)}</Label>
                <div className="flex gap-2 mt-1">
                  {(["en", "zh"] as const).map((l) => (
                    <Button key={l} variant={settings.preferences.interfaceLang === l ? "default" : "outline"} size="sm"
                      onClick={() => settings.updatePreferences({ interfaceLang: l })}>
                      {l === "en" ? "EN" : "中文"}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">{t("settings.storyLang", lang)}</Label>
                <div className="flex gap-2 mt-1">
                  {(["en", "zh"] as const).map((l) => (
                    <Button key={l} variant={settings.preferences.storyLang === l ? "default" : "outline"} size="sm"
                      onClick={() => settings.updatePreferences({ storyLang: l })}>
                      {l === "en" ? "EN" : "中文"}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">{t("settings.audioQuality", lang)}</Label>
                <div className="flex gap-2 mt-1">
                  {(["standard", "high"] as const).map((q) => (
                    <Button key={q} variant={settings.preferences.audioQuality === q ? "default" : "outline"} size="sm"
                      onClick={() => settings.updatePreferences({ audioQuality: q })}>
                      {t(`settings.${q}`, lang)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Danger */}
          <section className="glass-panel p-6 border-destructive/30">
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
