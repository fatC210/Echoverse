"use client";

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, ArrowLeft, Trash2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceGenderTabs } from "@/components/voice/VoiceGenderTabs";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { clearAllIndexedDbData } from "@/lib/db";
import { type EchoSettings } from "@/lib/constants/defaults";
import type { VoiceOption } from "@/lib/types/echoverse";
import {
  isElevenLabsVerified,
  listElevenLabsVoices,
  previewElevenLabsVoice,
  testElevenLabsConnection,
} from "@/lib/services/elevenlabs";
import { testLlmConnection } from "@/lib/services/llm";
import { testTurbopufferConnection } from "@/lib/services/turbopuffer";
import { useSettingsStore } from "@/lib/store/settings-store";
import {
  isLlmComplete,
  isLlmVerified,
  isTurbopufferComplete,
  isTurbopufferVerified,
  serializeLlmVerification,
  serializeTurbopufferVerification,
} from "@/lib/utils/settings-validation";
import {
  filterVoicesByGender,
  getEmptyVoiceFilterLabel,
  getVoiceOptionDisplayName,
  type VoiceGenderFilter,
} from "@/lib/utils/voices";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

function isElevenLabsComplete(elevenlabs: EchoSettings["elevenlabs"]) {
  return Boolean(elevenlabs.apiKey.trim());
}

function serializeElevenLabs(elevenlabs: EchoSettings["elevenlabs"]) {
  return elevenlabs.apiKey.trim();
}

function isSameLlm(a: EchoSettings["llm"], b: EchoSettings["llm"]) {
  return (
    a.baseUrl === b.baseUrl &&
    a.apiKey === b.apiKey &&
    a.model === b.model &&
    a.embeddingModel === b.embeddingModel
  );
}

function isSameElevenLabs(a: EchoSettings["elevenlabs"], b: EchoSettings["elevenlabs"]) {
  return a.apiKey === b.apiKey && a.verifiedApiKey === b.verifiedApiKey;
}

function isSameTurbopuffer(a: EchoSettings["turbopuffer"], b: EchoSettings["turbopuffer"]) {
  return a.baseUrl === b.baseUrl && a.apiKey === b.apiKey;
}

function isLeavingSection(event: FocusEvent<HTMLElement>) {
  const nextTarget = event.relatedTarget;
  return !(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget);
}

function isActivationKey(event: KeyboardEvent<HTMLElement>) {
  return event.key === "Enter" || event.key === " ";
}

interface SectionStatusProps {
  status: ConnectionStatus;
  lang: "en" | "zh";
}

function SectionStatus({ status, lang }: SectionStatusProps) {
  if (status === "idle") {
    return null;
  }

  if (status === "testing") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        {lang === "zh" ? "检测中..." : "Checking..."}
      </span>
    );
  }

  if (status === "success") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-accent">
        <CheckCircle2 size={14} />
        {t("onboarding.connected", lang)}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-destructive">
      <XCircle size={14} />
      {t("onboarding.failed", lang)}
    </span>
  );
}

interface SecretInputProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  isVisible: boolean;
  onBlur: () => void;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
}

function SecretInput({
  id,
  label,
  placeholder,
  value,
  isVisible,
  onBlur,
  onChange,
  onToggleVisibility,
}: SecretInputProps) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-1 block">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={isVisible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          className="input-game pr-10"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          onMouseDown={(event) => event.preventDefault()}
          className="hover-icon-accent absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground"
        >
          {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

const SettingsPage = () => {
  const router = useRouter();
  const llm = useSettingsStore((state) => state.llm);
  const elevenlabs = useSettingsStore((state) => state.elevenlabs);
  const turbopuffer = useSettingsStore((state) => state.turbopuffer);
  const voice = useSettingsStore((state) => state.voice);
  const preferences = useSettingsStore((state) => state.preferences);
  const updateLlm = useSettingsStore((state) => state.updateLlm);
  const updateElevenlabs = useSettingsStore((state) => state.updateElevenlabs);
  const updateTurbopuffer = useSettingsStore((state) => state.updateTurbopuffer);
  const updateVoice = useSettingsStore((state) => state.updateVoice);
  const updatePreferences = useSettingsStore((state) => state.updatePreferences);
  const clearSettings = useSettingsStore((state) => state.clearAll);

  const lang = preferences.interfaceLang;
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [llmDraft, setLlmDraft] = useState(llm);
  const [elevenlabsDraft, setElevenlabsDraft] = useState(elevenlabs);
  const [turbopufferDraft, setTurbopufferDraft] = useState(turbopuffer);
  const [llmStatus, setLlmStatus] = useState<ConnectionStatus>(
    isLlmVerified(llm) ? "success" : "idle",
  );
  const [elevenlabsStatus, setElevenlabsStatus] = useState<ConnectionStatus>(
    isElevenLabsVerified(elevenlabs) ? "success" : "idle",
  );
  const [turbopufferStatus, setTurbopufferStatus] = useState<ConnectionStatus>(
    isTurbopufferVerified(turbopuffer) ? "success" : "idle",
  );
  const [llmError, setLlmError] = useState("");
  const [elevenlabsError, setElevenlabsError] = useState("");
  const [turbopufferError, setTurbopufferError] = useState("");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceGenderFilter, setVoiceGenderFilter] =
    useState<VoiceGenderFilter>("all");

  const llmDraftRef = useRef(llmDraft);
  const elevenlabsDraftRef = useRef(elevenlabsDraft);
  const turbopufferDraftRef = useRef(turbopufferDraft);
  const llmSuccessSnapshotRef = useRef(
    isLlmVerified(llm) ? serializeLlmVerification(llm) : "",
  );
  const elevenlabsSuccessSnapshotRef = useRef(
    isElevenLabsVerified(elevenlabs) ? serializeElevenLabs(elevenlabs) : "",
  );
  const turbopufferSuccessSnapshotRef = useRef(
    isTurbopufferVerified(turbopuffer)
      ? serializeTurbopufferVerification(turbopuffer)
      : "",
  );
  const llmPendingSnapshotRef = useRef("");
  const elevenlabsPendingSnapshotRef = useRef("");
  const turbopufferPendingSnapshotRef = useRef("");
  const llmRequestRef = useRef(0);
  const elevenlabsRequestRef = useRef(0);
  const turbopufferRequestRef = useRef(0);

  llmDraftRef.current = llmDraft;
  elevenlabsDraftRef.current = elevenlabsDraft;
  turbopufferDraftRef.current = turbopufferDraft;

  const elevenlabsVerified = isElevenLabsVerified(elevenlabs);
  const hasPendingElevenLabsChanges =
    elevenlabsDraft.apiKey.trim() !== elevenlabs.apiKey.trim();
  const showVoiceLibrary = elevenlabsVerified && !hasPendingElevenLabsChanges;
  const filteredVoices = filterVoicesByGender(voices, voiceGenderFilter);

  const selectVoice = (item: VoiceOption) => {
    updateVoice({
      voiceId: item.voice_id,
      voiceName: item.name,
      voiceDescription: "",
    });
  };

  const toggleKey = (key: string) => {
    setShowKeys((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const resetLlmAutoCheck = (nextSnapshot: string) => {
    setLlmStatus("idle");
    setLlmError("");
    llmPendingSnapshotRef.current = "";

    if (
      llmSuccessSnapshotRef.current &&
      nextSnapshot !== llmSuccessSnapshotRef.current
    ) {
      llmSuccessSnapshotRef.current = "";
    }
  };

  const resetElevenLabsAutoCheck = (nextSnapshot: string) => {
    setElevenlabsStatus("idle");
    setElevenlabsError("");
    elevenlabsPendingSnapshotRef.current = "";

    if (
      elevenlabsSuccessSnapshotRef.current &&
      nextSnapshot !== elevenlabsSuccessSnapshotRef.current
    ) {
      elevenlabsSuccessSnapshotRef.current = "";
    }
  };

  const resetTurbopufferAutoCheck = (nextSnapshot: string) => {
    setTurbopufferStatus("idle");
    setTurbopufferError("");
    turbopufferPendingSnapshotRef.current = "";

    if (
      turbopufferSuccessSnapshotRef.current &&
      nextSnapshot !== turbopufferSuccessSnapshotRef.current
    ) {
      turbopufferSuccessSnapshotRef.current = "";
    }
  };

  const saveLlmDraft = () => {
    const nextLlm = llmDraftRef.current;

    if (!isSameLlm(nextLlm, llm)) {
      updateLlm(nextLlm);
    }
  };

  const saveElevenLabsDraft = () => {
    const nextElevenlabs = elevenlabsDraftRef.current;

    if (!isSameElevenLabs(nextElevenlabs, elevenlabs)) {
      updateElevenlabs(nextElevenlabs);
    }
  };

  const saveTurbopufferDraft = () => {
    const nextTurbopuffer = turbopufferDraftRef.current;

    if (!isSameTurbopuffer(nextTurbopuffer, turbopuffer)) {
      updateTurbopuffer(nextTurbopuffer);
    }
  };

  const maybeAutoCheckLlm = async () => {
    const nextLlm = llmDraftRef.current;
    const snapshot = serializeLlmVerification(nextLlm);

    if (!isLlmComplete(nextLlm)) {
      setLlmStatus("idle");
      setLlmError("");
      llmPendingSnapshotRef.current = "";
      return;
    }

    if (
      snapshot === llmSuccessSnapshotRef.current ||
      snapshot === llmPendingSnapshotRef.current
    ) {
      return;
    }

    llmPendingSnapshotRef.current = snapshot;
    setLlmStatus("testing");
    setLlmError("");

    const requestId = ++llmRequestRef.current;

    try {
      await testLlmConnection(nextLlm);

      if (
        requestId !== llmRequestRef.current ||
        snapshot !== serializeLlmVerification(llmDraftRef.current)
      ) {
        return;
      }

      updateLlm({ verifiedConfigSignature: snapshot });
      llmSuccessSnapshotRef.current = snapshot;
      llmPendingSnapshotRef.current = "";
      setLlmStatus("success");
    } catch (error) {
      if (
        requestId !== llmRequestRef.current ||
        snapshot !== serializeLlmVerification(llmDraftRef.current)
      ) {
        return;
      }

      llmPendingSnapshotRef.current = "";
      setLlmStatus("error");
      setLlmError(error instanceof Error ? error.message : "LLM request failed");
    }
  };

  const maybeAutoCheckElevenLabs = async () => {
    const nextElevenlabs = elevenlabsDraftRef.current;
    const snapshot = serializeElevenLabs(nextElevenlabs);

    if (!isElevenLabsComplete(nextElevenlabs)) {
      setElevenlabsStatus("idle");
      setElevenlabsError("");
      elevenlabsPendingSnapshotRef.current = "";
      return;
    }

    if (
      snapshot === elevenlabsSuccessSnapshotRef.current ||
      snapshot === elevenlabsPendingSnapshotRef.current
    ) {
      return;
    }

    elevenlabsPendingSnapshotRef.current = snapshot;
    setElevenlabsStatus("testing");
    setElevenlabsError("");

    const requestId = ++elevenlabsRequestRef.current;

    try {
      await testElevenLabsConnection(nextElevenlabs);

      if (
        requestId !== elevenlabsRequestRef.current ||
        snapshot !== serializeElevenLabs(elevenlabsDraftRef.current)
      ) {
        return;
      }

      updateElevenlabs({ verifiedApiKey: nextElevenlabs.apiKey.trim() });
      elevenlabsSuccessSnapshotRef.current = snapshot;
      elevenlabsPendingSnapshotRef.current = "";
      setElevenlabsStatus("success");
    } catch (error) {
      if (
        requestId !== elevenlabsRequestRef.current ||
        snapshot !== serializeElevenLabs(elevenlabsDraftRef.current)
      ) {
        return;
      }

      elevenlabsPendingSnapshotRef.current = "";
      setElevenlabsStatus("error");
      setElevenlabsError(
        error instanceof Error ? error.message : "ElevenLabs request failed",
      );
    }
  };

  const maybeAutoCheckTurbopuffer = async () => {
    const nextTurbopuffer = turbopufferDraftRef.current;
    const snapshot = serializeTurbopufferVerification(nextTurbopuffer);

    if (!isTurbopufferComplete(nextTurbopuffer)) {
      setTurbopufferStatus("idle");
      setTurbopufferError("");
      turbopufferPendingSnapshotRef.current = "";
      return;
    }

    if (
      snapshot === turbopufferSuccessSnapshotRef.current ||
      snapshot === turbopufferPendingSnapshotRef.current
    ) {
      return;
    }

    turbopufferPendingSnapshotRef.current = snapshot;
    setTurbopufferStatus("testing");
    setTurbopufferError("");

    const requestId = ++turbopufferRequestRef.current;

    try {
      await testTurbopufferConnection(nextTurbopuffer);

      if (
        requestId !== turbopufferRequestRef.current ||
        snapshot !== serializeTurbopufferVerification(turbopufferDraftRef.current)
      ) {
        return;
      }

      updateTurbopuffer({ verifiedConfigSignature: snapshot });
      turbopufferSuccessSnapshotRef.current = snapshot;
      turbopufferPendingSnapshotRef.current = "";
      setTurbopufferStatus("success");
    } catch (error) {
      if (
        requestId !== turbopufferRequestRef.current ||
        snapshot !== serializeTurbopufferVerification(turbopufferDraftRef.current)
      ) {
        return;
      }

      turbopufferPendingSnapshotRef.current = "";
      setTurbopufferStatus("error");
      setTurbopufferError(
        error instanceof Error ? error.message : "turbopuffer request failed",
      );
    }
  };

  const handleLlmSectionBlur = (event: FocusEvent<HTMLElement>) => {
    if (!isLeavingSection(event)) {
      return;
    }

    void maybeAutoCheckLlm();
  };

  const handleElevenLabsSectionBlur = (event: FocusEvent<HTMLElement>) => {
    if (!isLeavingSection(event)) {
      return;
    }

    void maybeAutoCheckElevenLabs();
  };

  const handleTurbopufferSectionBlur = (event: FocusEvent<HTMLElement>) => {
    if (!isLeavingSection(event)) {
      return;
    }

    void maybeAutoCheckTurbopuffer();
  };

  const previewVoice = async (voiceId: string) => {
    if (playingVoice) {
      setPlayingVoice(null);
      return;
    }

    setPlayingVoice(voiceId);

    try {
      const result = await previewElevenLabsVoice(
        elevenlabs,
        voiceId,
        "The sun slowly sank behind the distant hills.",
      );
      const url = URL.createObjectURL(result.blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingVoice(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      // Ignore preview playback failures in settings.
    }

    setTimeout(() => setPlayingVoice(null), 10000);
  };

  const clearAll = () => {
    if (window.confirm(t("settings.clearConfirm", lang))) {
      void clearAllIndexedDbData().finally(() => {
        clearSettings();
        router.push("/");
      });
    }
  };

  useEffect(() => {
    setLlmDraft(llm);
  }, [llm]);

  useEffect(() => {
    setElevenlabsDraft(elevenlabs);
  }, [elevenlabs]);

  useEffect(() => {
    setTurbopufferDraft(turbopuffer);
  }, [turbopuffer]);

  useEffect(() => {
    if (isLlmVerified(llm)) {
      llmSuccessSnapshotRef.current = serializeLlmVerification(llm);
      setLlmStatus("success");
      setLlmError("");
      return;
    }

    llmSuccessSnapshotRef.current = "";

    if (!llmDraft.apiKey.trim()) {
      setLlmStatus("idle");
      setLlmError("");
    }
  }, [llm, llmDraft.apiKey]);

  useEffect(() => {
    if (isTurbopufferVerified(turbopuffer)) {
      turbopufferSuccessSnapshotRef.current =
        serializeTurbopufferVerification(turbopuffer);
      setTurbopufferStatus("success");
      setTurbopufferError("");
      return;
    }

    turbopufferSuccessSnapshotRef.current = "";

    if (!turbopufferDraft.apiKey.trim()) {
      setTurbopufferStatus("idle");
      setTurbopufferError("");
    }
  }, [turbopuffer, turbopufferDraft.apiKey]);

  useEffect(() => {
    if (!showVoiceLibrary) {
      setVoices([]);
      setIsLoadingVoices(false);
      return;
    }

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
  }, [elevenlabs, showVoiceLibrary]);

  useEffect(() => {
    if (showVoiceLibrary) {
      elevenlabsSuccessSnapshotRef.current = serializeElevenLabs(elevenlabs);
      setElevenlabsStatus("success");
      setElevenlabsError("");
      return;
    }

    if (!elevenlabsDraft.apiKey.trim()) {
      setElevenlabsStatus("idle");
      setElevenlabsError("");
    }
  }, [elevenlabs, elevenlabsDraft.apiKey, showVoiceLibrary]);

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--accent)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--accent)) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </Button>
          <h1 className="text-2xl font-bold font-serif text-accent">
            {t("settings.title", lang)}
          </h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <section
            className="glass-panel-strong p-6 space-y-4"
            onBlur={handleLlmSectionBlur}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-lg font-semibold font-serif">LLM</h2>
              <SectionStatus status={llmStatus} lang={lang} />
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="llm-base-url"
                  className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-1 block"
                >
                  {t("onboarding.llm.baseUrl", lang)}
                </label>
                <Input
                  id="llm-base-url"
                  placeholder={t("onboarding.placeholder.baseUrl", lang)}
                  value={llmDraft.baseUrl}
                  onBlur={saveLlmDraft}
                  onChange={(event) => {
                    const nextLlm = {
                      ...llmDraftRef.current,
                      baseUrl: event.target.value,
                    };
                    setLlmDraft(nextLlm);
                    resetLlmAutoCheck(serializeLlmVerification(nextLlm));
                  }}
                  className="input-game"
                />
              </div>

              <SecretInput
                id="llm-api-key"
                label={t("onboarding.llm.apiKey", lang)}
                placeholder={t("onboarding.placeholder.apiKey", lang)}
                value={llmDraft.apiKey}
                isVisible={Boolean(showKeys.llm)}
                onBlur={saveLlmDraft}
                onChange={(value) => {
                  const nextLlm = {
                    ...llmDraftRef.current,
                    apiKey: value,
                  };
                  setLlmDraft(nextLlm);
                  resetLlmAutoCheck(serializeLlmVerification(nextLlm));
                }}
                onToggleVisibility={() => toggleKey("llm")}
              />

              <div>
                <label
                  htmlFor="llm-model"
                  className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-1 block"
                >
                  {t("onboarding.llm.model", lang)}
                </label>
                <Input
                  id="llm-model"
                  placeholder={t("onboarding.placeholder.model", lang)}
                  value={llmDraft.model}
                  onBlur={saveLlmDraft}
                  onChange={(event) => {
                    const nextLlm = {
                      ...llmDraftRef.current,
                      model: event.target.value,
                    };
                    setLlmDraft(nextLlm);
                    resetLlmAutoCheck(serializeLlmVerification(nextLlm));
                  }}
                  className="input-game"
                />
              </div>

              <div>
                <label
                  htmlFor="llm-embedding-model"
                  className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-1 block"
                >
                  {t("onboarding.llm.embeddingModel", lang)}
                </label>
                <Input
                  id="llm-embedding-model"
                  placeholder={t("onboarding.placeholder.embeddingModel", lang)}
                  value={llmDraft.embeddingModel}
                  onBlur={saveLlmDraft}
                  onChange={(event) => {
                    const nextLlm = {
                      ...llmDraftRef.current,
                      embeddingModel: event.target.value,
                    };
                    setLlmDraft(nextLlm);
                    resetLlmAutoCheck(serializeLlmVerification(nextLlm));
                  }}
                  className="input-game"
                />
              </div>

              {llmStatus === "error" && llmError && (
                <p className="text-xs leading-relaxed text-destructive/90">
                  {llmError}
                </p>
              )}
            </div>
          </section>

          <section
            className="glass-panel-strong p-6 space-y-4"
            onBlur={handleElevenLabsSectionBlur}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-lg font-semibold font-serif">ElevenLabs</h2>
              <SectionStatus status={elevenlabsStatus} lang={lang} />
            </div>

            <SecretInput
              id="elevenlabs-api-key"
              label={t("onboarding.elevenlabs.apiKey", lang)}
              placeholder={t("onboarding.placeholder.apiKey", lang)}
              value={elevenlabsDraft.apiKey}
              isVisible={Boolean(showKeys.el)}
              onBlur={saveElevenLabsDraft}
              onChange={(value) => {
                const nextElevenlabs = {
                  ...elevenlabsDraftRef.current,
                  apiKey: value,
                };
                setElevenlabsDraft(nextElevenlabs);
                setVoices([]);
                resetElevenLabsAutoCheck(serializeElevenLabs(nextElevenlabs));
              }}
              onToggleVisibility={() => toggleKey("el")}
            />

            {elevenlabsStatus === "error" && elevenlabsError && (
              <p className="text-xs leading-relaxed text-destructive/90">
                {elevenlabsError}
              </p>
            )}

            {showVoiceLibrary && (
              <div className="space-y-4 border-t border-border/30 pt-4">
                <h3 className="text-sm font-semibold font-serif">
                  {t("settings.voiceSettings", lang)}
                </h3>
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
                      <div className="grid grid-cols-4 gap-2">
                        {filteredVoices.map((item) => (
                          <div
                            key={item.voice_id}
                            onClick={() => selectVoice(item)}
                            onKeyDown={(event) => {
                              if (!isActivationKey(event)) {
                                return;
                              }

                              event.preventDefault();
                              selectVoice(item);
                            }}
                            role="button"
                            tabIndex={0}
                            className={`relative flex flex-col items-center p-3 rounded-xl text-sm transition-all ${
                              voice.voiceId === item.voice_id
                                ? "bg-accent/15 border border-accent/40 glow-accent"
                                : "hover-surface border border-border/30 text-muted-foreground"
                            }`}
                          >
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs mb-1.5 ${
                                voice.voiceId === item.voice_id
                                  ? "bg-accent/20 text-accent"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {item.labels?.gender === "female"
                                ? "♀"
                                : item.labels?.gender === "male"
                                  ? "♂"
                                  : "•"}
                            </div>
                            <span className="font-medium text-xs text-center leading-tight">
                              {getVoiceOptionDisplayName(item, lang)}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void previewVoice(item.voice_id);
                              }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-muted/50 hover:bg-accent/20 flex items-center justify-center text-muted-foreground hover:text-accent transition-colors"
                            >
                              {playingVoice === item.voice_id ? (
                                <Square size={8} />
                              ) : (
                                <Play size={8} />
                              )}
                            </button>
                            {voice.voiceId === item.voice_id && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent status-dot" />
                            )}
                          </div>
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
              </div>
            )}
          </section>

          <section
            className="glass-panel-strong p-6 space-y-4"
            onBlur={handleTurbopufferSectionBlur}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-lg font-semibold font-serif">turbopuffer</h2>
              <SectionStatus status={turbopufferStatus} lang={lang} />
            </div>

            <SecretInput
              id="turbopuffer-api-key"
              label={t("onboarding.turbopuffer.apiKey", lang)}
              placeholder={t("onboarding.placeholder.apiKey", lang)}
              value={turbopufferDraft.apiKey}
              isVisible={Boolean(showKeys.tp)}
              onBlur={saveTurbopufferDraft}
              onChange={(value) => {
                const nextTurbopuffer = {
                  ...turbopufferDraftRef.current,
                  apiKey: value,
                };
                setTurbopufferDraft(nextTurbopuffer);
                resetTurbopufferAutoCheck(
                  serializeTurbopufferVerification(nextTurbopuffer),
                );
              }}
              onToggleVisibility={() => toggleKey("tp")}
            />

            {turbopufferStatus === "error" && turbopufferError && (
              <p className="text-xs leading-relaxed text-destructive/90">
                {turbopufferError}
              </p>
            )}
          </section>

          <section className="glass-panel-strong p-6 space-y-4">
            <h2 className="text-lg font-semibold font-serif">
              {t("settings.preferences", lang)}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-2 block">
                  {t("settings.interfaceLang", lang)}
                </label>
                <div className="flex gap-2">
                  {(["en", "zh"] as const).map((value) => (
                    <Button
                      key={value}
                      variant={preferences.interfaceLang === value ? "default" : "outline"}
                      size="sm"
                      onClick={() => updatePreferences({ interfaceLang: value })}
                      className={
                        preferences.interfaceLang === value
                          ? "bg-accent text-accent-foreground"
                          : "border-accent/30 hover:border-accent/60"
                      }
                    >
                      {value === "en" ? "EN" : "中文"}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-mono tracking-wider uppercase mb-2 block">
                  {t("settings.storyLang", lang)}
                </label>
                <div className="flex gap-2">
                  {(["en", "zh"] as const).map((value) => (
                    <Button
                      key={value}
                      variant={preferences.storyLang === value ? "default" : "outline"}
                      size="sm"
                      onClick={() => updatePreferences({ storyLang: value })}
                      className={
                        preferences.storyLang === value
                          ? "bg-accent text-accent-foreground"
                          : "border-accent/30 hover:border-accent/60"
                      }
                    >
                      {value === "en" ? "EN" : "中文"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>

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
