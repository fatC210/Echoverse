import { useEffect, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceGenderTabs } from "@/components/voice/VoiceGenderTabs";
import { useSettingsStore } from "@/lib/store/settings-store";
import {
  filterVoicesByGender,
  getEmptyVoiceFilterLabel,
  getVoiceOptionDisplayName,
  type VoiceGenderFilter,
} from "@/lib/utils/voices";
import {
  isElevenLabsVerified,
  listElevenLabsVoices,
  previewElevenLabsVoice,
  testElevenLabsConnection,
} from "@/lib/services/elevenlabs";
import type { VoiceOption } from "@/lib/types/echoverse";
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
  const [errorMessage, setErrorMessage] = useState("");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceGenderFilter, setVoiceGenderFilter] =
    useState<VoiceGenderFilter>("all");
  const elevenlabsVerified = isElevenLabsVerified(elevenlabs);
  const filteredVoices = filterVoicesByGender(voices, voiceGenderFilter);

  const playBlob = async (blob: Blob, voiceId: string) => {
    const url = URL.createObjectURL(blob);
    try {
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingVoice(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("Preview playback failed");
    }
  };

  const testConnection = async () => {
    setTestStatus("testing");
    setErrorMessage("");
    try {
      await testElevenLabsConnection(elevenlabs);
      updateElevenlabs({ verifiedApiKey: elevenlabs.apiKey.trim() });
      setTestStatus("success");
    } catch (error) {
      setTestStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "ElevenLabs request failed");
    }
  };

  const selectVoice = (v: VoiceOption) => {
    updateVoice({
      voiceId: v.voice_id,
      voiceName: v.name,
      voiceDescription: "",
    });
  };

  const previewVoice = async (voiceId: string) => {
    if (playingVoice) { setPlayingVoice(null); return; }
    setPlayingVoice(voiceId);
    try {
      const result = await previewElevenLabsVoice(
        elevenlabs,
        voiceId,
        "The sun slowly sank behind the distant hills, casting long shadows across the valley.",
      );
      await playBlob(result.blob, voiceId);
    } catch {}
    setTimeout(() => setPlayingVoice(null), 10000);
  };

  const selectVoiceFromKeyboard = (event: KeyboardEvent<HTMLDivElement>, voiceOption: VoiceOption) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    selectVoice(voiceOption);
  };

  useEffect(() => {
    if (!elevenlabsVerified) {
      setVoices([]);
      setIsLoadingVoices(false);
      return;
    }

    setTestStatus((current) => (current === "idle" ? "success" : current));

    let cancelled = false;

    const syncVoices = async () => {
      setIsLoadingVoices(true);
      try {
        const loadedVoices = await listElevenLabsVoices(elevenlabs);
        if (!cancelled) {
          setVoices(loadedVoices);
        }
      } catch {
        if (!cancelled) {
          setVoices([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingVoices(false);
        }
      }
    };

    void syncVoices();

    return () => {
      cancelled = true;
    };
  }, [elevenlabs, elevenlabs.apiKey, elevenlabs.verifiedApiKey, elevenlabsVerified]);

  const hasVoice = !!voice.voiceId;
  const isConnectionReady = testStatus === "success" || elevenlabsVerified;
  const canProceed = isConnectionReady && hasVoice;

  return (
    <div className="glass-panel-strong p-8 space-y-5 scanline">
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
              placeholder={t("onboarding.placeholder.apiKey", lang)}
              value={elevenlabs.apiKey}
              onChange={(e) => {
                updateElevenlabs({ apiKey: e.target.value });
                setVoices([]);
                setTestStatus("idle");
                setErrorMessage("");
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
            disabled={!elevenlabs.apiKey.trim() || testStatus === "testing"}
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
        {testStatus === "error" && errorMessage && (
          <p className="text-xs leading-relaxed text-destructive/90">{errorMessage}</p>
        )}

        {isConnectionReady && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="border-t border-border/30 pt-4"
          >
            <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-3 block">
              {t("onboarding.elevenlabs.selectVoice", lang)}
            </label>
            {isLoadingVoices ? (
              <p className="text-sm text-muted-foreground">
                {t("elevenlabs.loadingVoices", lang)}
              </p>
            ) : voices.length ? (
              <div className="space-y-3">
                <VoiceGenderTabs
                  lang={lang}
                  value={voiceGenderFilter}
                  onChange={setVoiceGenderFilter}
                />
                {filteredVoices.length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredVoices.map((v, i) => (
                      <motion.div
                        key={v.voice_id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => selectVoice(v)}
                        onKeyDown={(event) => selectVoiceFromKeyboard(event, v)}
                        role="button"
                        tabIndex={0}
                        className={`relative flex flex-col items-center p-3 rounded-xl text-sm transition-all ${
                          voice.voiceId === v.voice_id
                            ? "bg-accent/15 border border-accent/40 glow-accent"
                            : "hover-surface border border-border/30 text-muted-foreground"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs mb-1.5 ${
                            voice.voiceId === v.voice_id
                              ? "bg-accent/20 text-accent"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {v.labels?.gender === "female"
                            ? "♀"
                            : v.labels?.gender === "male"
                              ? "♂"
                              : "•"}
                        </div>
                        <span className="font-medium text-xs">
                          {getVoiceOptionDisplayName(v, lang)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void previewVoice(v.voice_id);
                          }}
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-muted/50 hover:bg-accent/20 flex items-center justify-center text-muted-foreground hover:text-accent transition-colors"
                        >
                          {playingVoice === v.voice_id ? (
                            <Square size={8} />
                          ) : (
                            <Play size={8} />
                          )}
                        </button>
                        {voice.voiceId === v.voice_id && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent status-dot" />
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {getEmptyVoiceFilterLabel(lang)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("elevenlabs.emptyVoices", lang)}
              </p>
            )}
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
