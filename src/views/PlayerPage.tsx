"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { MOOD_MAP, type MoodType } from "@/lib/constants/moods";
import { getStory, listSegmentsByStory, putPlayerProfile, putStory } from "@/lib/db";
import { getAudioMixer, type MixerVolumes } from "@/lib/engine/audio-mixer";
import { exportStoryAudioMp3, exportStoryMarkdown, exportWorldJson } from "@/lib/engine/exporter";
import { createEmptyPlayerProfile } from "@/lib/engine/player-profile";
import {
  advanceStory,
  listStoryAssetMap,
  type AdvanceStoryStage,
} from "@/lib/engine/story-runtime";
import { isElevenLabsVerified, listElevenLabsVoices, previewElevenLabsVoice } from "@/lib/services/elevenlabs";
import type { AudioAsset, Segment, Story, VoiceOption } from "@/lib/types/echoverse";
import { createId, formatDuration } from "@/lib/utils/echoverse";
import { summarizeAudioLayerLabel } from "@/lib/utils/audio-layer-labels";
import {
  buildNarrationRevealThresholds,
  getVisibleNarrationChunkCount,
  splitNarrationForReveal,
} from "@/lib/utils/narration";
import {
  filterVoicesByGender,
  getEmptyVoiceFilterLabel,
  getVoiceOptionDisplayName,
  type VoiceGenderFilter,
} from "@/lib/utils/voices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceGenderTabs } from "@/components/voice/VoiceGenderTabs";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft,
  Clapperboard,
  Download,
  Edit3,
  FileText,
  GitBranch as GitBranchIcon,
  Home,
  Layers,
  MessageCircle,
  Mic,
  Music,
  Pause,
  Package,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Square,
  Timer,
  Volume1,
  Volume2,
  X,
} from "lucide-react";

const FALLBACK_PREVIEW_TEXT =
  "The sun slowly sank behind the distant hills, casting long shadows across the valley.";

type LoadingOverlayStep = {
  text: string;
  state: "pending" | "active" | "completed";
};

function waitForActivePlaybackDuration({
  durationMs,
  isPausedRef,
  completion,
  onTimeout,
  signal,
}: {
  durationMs: number;
  isPausedRef: { current: boolean };
  completion?: Promise<void>;
  onTimeout?: () => void;
  signal?: AbortSignal;
}) {
  return new Promise<void>((resolve, reject) => {
    let remainingMs = Math.max(durationMs, 0);
    let lastTickAt = Date.now();
    let completionResolvedWhilePaused = false;
    let settled = false;
    let timerId: number | null = null;

    const cleanup = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }

      signal?.removeEventListener("abort", handleAbort);
    };

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    const handleAbort = () => {
      settle(resolve);
    };

    const handleTick = () => {
      timerId = window.setTimeout(() => {
        const now = Date.now();
        const elapsedMs = now - lastTickAt;
        lastTickAt = now;

        if (!isPausedRef.current) {
          remainingMs -= elapsedMs;
        }

        if (completionResolvedWhilePaused && remainingMs <= 0) {
          settle(resolve);
          return;
        }

        if (remainingMs <= 0) {
          onTimeout?.();
          settle(resolve);
          return;
        }

        handleTick();
      }, Math.min(Math.max(remainingMs, 1), 100));
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    signal?.addEventListener("abort", handleAbort, { once: true });

    if (completion) {
      completion.then(
        () => {
          if (isPausedRef.current) {
            completionResolvedWhilePaused = true;
            return;
          }

          settle(resolve);
        },
        (error) => settle(() => reject(error)),
      );
    }

    if (remainingMs <= 0) {
      onTimeout?.();
      settle(resolve);
      return;
    }

    handleTick();
  });
}

const ADVANCE_STORY_STAGE_ORDER: AdvanceStoryStage[] = [
  "retrieval_context",
  "generate_segment",
  "resolve_audio",
];

function buildAdvanceStoryLoadingSteps(
  lang: "en" | "zh",
  activeStage: AdvanceStoryStage,
): LoadingOverlayStep[] {
  const labels: Record<AdvanceStoryStage, string> = {
    retrieval_context:
      lang === "zh" ? "正在检索世界上下文..." : "Retrieving world context...",
    generate_segment:
      lang === "zh" ? "正在生成叙事段落..." : "Generating the next segment...",
    resolve_audio:
      lang === "zh" ? "正在解析音频层..." : "Resolving audio layers...",
  };
  const activeIndex = ADVANCE_STORY_STAGE_ORDER.indexOf(activeStage);

  return ADVANCE_STORY_STAGE_ORDER.map((stage, index) => ({
    text: labels[stage],
    state: index < activeIndex ? "completed" : index === activeIndex ? "active" : "pending",
  }));
}

function AtmosphericBackground({ mood }: { mood: MoodType }) {
  const config = MOOD_MAP[mood];
  return (
    <div className="fixed inset-0 bg-black transition-all duration-[3000ms]">
      <div
        className={`absolute inset-0 ${config.animation}`}
        style={{
          background: `radial-gradient(circle at 20% 20%, ${config.colors[0]}, transparent 45%), radial-gradient(circle at 80% 30%, ${config.colors[1]}, transparent 40%), linear-gradient(135deg, ${config.colors[0]}, ${config.colors[1]}, ${config.colors[2]})`,
          animationDuration: config.duration,
          opacity: 0.95,
        }}
      />
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}

function NarrationDisplay({
  text,
  isPlaying,
  isPaused,
  forceFullText,
  durationSec,
  narrationStartAtSec,
  getPlaybackTimeSec,
}: {
  text: string;
  isPlaying: boolean;
  isPaused: boolean;
  forceFullText: boolean;
  durationSec: number;
  narrationStartAtSec: number | null;
  getPlaybackTimeSec: () => number | null;
}) {
  const chunks = useMemo(() => splitNarrationForReveal(text), [text]);
  const thresholds = useMemo(
    () => buildNarrationRevealThresholds(chunks),
    [chunks],
  );
  const [visibleChunks, setVisibleChunks] = useState(chunks.length);
  const previousTextRef = useRef(text);
  const previousIsPlayingRef = useRef(isPlaying);

  useEffect(() => {
    if (!isPlaying && !isPaused) {
      setVisibleChunks(chunks.length);
    }
  }, [chunks.length, isPaused, isPlaying]);

  useEffect(() => {
    if (previousTextRef.current !== text) {
      previousTextRef.current = text;

      if (isPlaying || isPaused) {
        setVisibleChunks(0);
        return;
      }

      setVisibleChunks(chunks.length);
      return;
    }
  }, [chunks.length, isPaused, isPlaying, text]);

  useEffect(() => {
    if (isPlaying && !previousIsPlayingRef.current) {
      setVisibleChunks(0);
    }

    previousIsPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (forceFullText) {
      setVisibleChunks(chunks.length);
    }
  }, [chunks.length, forceFullText]);

  useEffect(() => {
    if (!isPlaying || isPaused) {
      return;
    }

    if (narrationStartAtSec !== null && durationSec > 0) {
      let frameId = 0;

      const syncWithAudioClock = () => {
        const currentTimeSec = getPlaybackTimeSec();
        const elapsedSec =
          currentTimeSec === null ? 0 : Math.max(currentTimeSec - narrationStartAtSec, 0);
        const progress = Math.min(elapsedSec / durationSec, 1);
        const nextVisibleChunks = getVisibleNarrationChunkCount(thresholds, progress);

        setVisibleChunks((current) =>
          current === nextVisibleChunks ? current : nextVisibleChunks,
        );

        if (progress < 1) {
          frameId = window.requestAnimationFrame(syncWithAudioClock);
        }
      };

      frameId = window.requestAnimationFrame(syncWithAudioClock);
      return () => window.cancelAnimationFrame(frameId);
    }

    const totalDurationMs = Math.max(durationSec * 1000, chunks.length * 150, 2500);
    const stepMs = Math.max(60, Math.floor(totalDurationMs / Math.max(chunks.length, 1)));
    const interval = window.setInterval(() => {
      setVisibleChunks((current) => {
        if (current >= chunks.length) {
          window.clearInterval(interval);
          return chunks.length;
        }
        return current + 1;
      });
    }, stepMs);

    return () => window.clearInterval(interval);
  }, [
    chunks.length,
    durationSec,
    getPlaybackTimeSec,
    isPaused,
    isPlaying,
    narrationStartAtSec,
    thresholds,
  ]);

  const renderedChunkCount = forceFullText ? chunks.length : visibleChunks;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-0">
      <p className="narration-text pb-0 leading-relaxed text-foreground/90">
        {chunks.slice(0, renderedChunkCount).join("")}
        {isPlaying && !forceFullText && renderedChunkCount < chunks.length ? <span className="ml-1 inline-block h-5 w-[2px] animate-pulse bg-accent" /> : null}
      </p>
    </div>
  );
}

function AudioLayerIndicator({
  activeLayers,
  mutedLayers,
  isAnimating,
  onToggle,
}: {
  activeLayers: Array<{ type: "tts" | "sfx" | "music"; name: string; active: boolean }>;
  mutedLayers: Record<"tts" | "sfx" | "music", boolean>;
  isAnimating: boolean;
  onToggle: (layer: "tts" | "sfx" | "music") => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 px-4 py-2 text-muted-foreground">
      <div className="flex h-4 items-center gap-[1px]">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="wave-bar"
            style={{
              animationDelay: `${index * 0.15}s`,
              animationPlayState: isAnimating ? "running" : "paused",
              height: `${6 + ((index * 5) % 10)}px`,
              opacity: isAnimating ? 1 : 0.45,
            }}
          />
        ))}
      </div>
      {activeLayers.filter((layer) => layer.active).map((layer) => (
        <button
          key={layer.type}
          onClick={() => onToggle(layer.type)}
          title={layer.name}
          className={`hover-surface rounded-full border px-3 py-1 text-xs transition-all ${
            mutedLayers[layer.type] ? "border-border/50 text-muted-foreground/60" : "border-accent/40 bg-accent/10 text-foreground"
          }`}
        >
          {layer.type === "sfx" ? <Volume1 size={12} className="mr-1 inline" /> : null}
          {layer.type === "music" ? <Music size={12} className="mr-1 inline" /> : null}
          {layer.type === "tts" ? <MessageCircle size={12} className="mr-1 inline" /> : null}
          <span className="inline-block max-w-[14rem] truncate align-middle whitespace-nowrap">{layer.name}</span>
        </button>
      ))}
    </div>
  );
}

function ChoicePanel({
  choices,
  onSelect,
  countdown,
  isPaused,
  footer,
}: {
  choices: Segment["audioScript"]["choices"];
  onSelect: (choiceId: string, freeText?: string) => void;
  countdown: number;
  isPaused: boolean;
  footer?: ReactNode;
}) {
  const lang = useSettingsStore((state) => state.preferences.interfaceLang);
  const [freeText, setFreeText] = useState("");
  const [isComposingFreeText, setIsComposingFreeText] = useState(false);
  const [timeLeft, setTimeLeft] = useState(countdown);
  const hasAutoSelectedRef = useRef(false);
  const trimmedFreeText = freeText.trim();
  const hasPendingCustomAction = trimmedFreeText.length > 0 || isComposingFreeText;

  const submitFreeText = useCallback(() => {
    if (isPaused || !trimmedFreeText) {
      return;
    }

    setFreeText("");
    setIsComposingFreeText(false);
    onSelect("free_text", trimmedFreeText);
  }, [isPaused, onSelect, trimmedFreeText]);

  useEffect(() => {
    hasAutoSelectedRef.current = false;
    setFreeText("");
    setIsComposingFreeText(false);
    setTimeLeft(countdown);
  }, [choices, countdown]);

  useEffect(() => {
    if (isPaused || timeLeft <= 0 || hasPendingCustomAction) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [hasPendingCustomAction, isPaused, timeLeft]);

  useEffect(() => {
    if (isPaused || hasPendingCustomAction || timeLeft > 0 || hasAutoSelectedRef.current) {
      return;
    }

    hasAutoSelectedRef.current = true;
    onSelect(choices[0]?.id ?? "choice_1");
  }, [choices, hasPendingCustomAction, isPaused, onSelect, timeLeft]);

  useEffect(() => {
    if (isPaused) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.isComposing ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT"))
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const keyedIndex = ["1", "2", "3", "a", "b", "c"].indexOf(key);
      if (keyedIndex === -1) {
        return;
      }
      const choice = choices[keyedIndex % 3];
      if (choice) {
        onSelect(choice.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [choices, isPaused, onSelect]);

  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl space-y-3 px-4">
      {choices.map((choice, index) => (
        <button
          key={choice.id}
          disabled={isPaused}
          onClick={() => onSelect(choice.id)}
          className={`group w-full rounded-xl border border-border bg-card/60 p-4 text-left backdrop-blur-sm transition-all ${
            isPaused ? "cursor-not-allowed opacity-60" : "hover:border-accent/50 hover:bg-card/80"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent/20 text-sm font-bold text-accent">
              {["A", "B", "C"][index] ?? index + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground transition-colors group-hover:text-accent">{choice.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">{choice.hint}</p>
            </div>
          </div>
        </button>
      ))}

      <div className="rounded-xl border border-dashed border-accent/30 bg-card/50 p-4 backdrop-blur-sm">
        <div className="flex gap-2">
          <Input
            disabled={isPaused}
            value={freeText}
            onChange={(event) => setFreeText(event.target.value)}
            onCompositionStart={() => setIsComposingFreeText(true)}
            onCompositionEnd={() => setIsComposingFreeText(false)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              submitFreeText();
            }}
            placeholder={t("player.freeText", lang)}
            className="border-border bg-card/60 backdrop-blur-sm"
          />
          <Button
            type="button"
            disabled={isPaused || !trimmedFreeText}
            onClick={submitFreeText}
            className="min-w-24 bg-accent text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} className="mr-2" />
            {t("player.freeTextSubmit", lang)}
          </Button>
        </div>
      </div>

      {footer}

      <p className="text-center text-xs text-muted-foreground">
        {t("player.autoSelect", lang)}: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
      </p>
    </motion.div>
  );
}

function VolumeControl({ volumes, onChange }: { volumes: MixerVolumes; onChange: (key: keyof MixerVolumes, value: number) => void }) {
  const lang = useSettingsStore((state) => state.preferences.interfaceLang);
  const sliders = [
    { key: "master" as const, label: t("player.masterVolume", lang), icon: <Volume2 size={14} /> },
    { key: "narration" as const, label: t("player.narrationVolume", lang), icon: <MessageCircle size={14} /> },
    { key: "sfx" as const, label: t("player.sfxVolume", lang), icon: <Volume1 size={14} /> },
    { key: "music" as const, label: t("player.musicVolume", lang), icon: <Music size={14} /> },
  ];

  return (
    <div className="w-64 space-y-4 rounded-xl border border-border bg-background p-4 shadow-lg">
      {sliders.map((slider) => (
        <div key={slider.key} className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{slider.icon} {slider.label}</span>
            <span>{Math.round(volumes[slider.key] * 100)}%</span>
          </div>
          <Slider value={[volumes[slider.key] * 100]} onValueChange={([value]) => onChange(slider.key, value / 100)} max={100} step={1} />
        </div>
      ))}
    </div>
  );
}

function LoadingOverlay({
  open,
  steps,
  error,
  onRetry,
}: {
  open: boolean;
  steps: LoadingOverlayStep[];
  error: string | null;
  onRetry: (() => void) | null;
}) {
  if (!open && !error) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 text-center">
        <div className="mx-auto flex h-16 items-end justify-center gap-[3px]">
          {Array.from({ length: 12 }).map((_, index) => (
            <motion.div
              key={index}
              className="w-1 rounded-full bg-accent"
              animate={{ height: [8, 24 + Math.random() * 32, 8] }}
              transition={{ duration: 1.2 + Math.random() * 0.5, delay: index * 0.06, repeat: Infinity }}
            />
          ))}
        </div>
        {steps.map((step, index) => (
          <p
            key={`${step.text}_${index}`}
            className={`font-serif text-lg ${
              step.state === "active"
                ? "text-foreground"
                : step.state === "completed"
                  ? "text-muted-foreground"
                  : "text-muted-foreground/30"
            }`}
          >
            {step.state === "completed" ? <span className="mr-2 text-accent">✓</span> : null}
            {step.state === "active" ? (
              <RefreshCw size={14} className="mr-2 inline animate-spin text-accent" />
            ) : null}
            {step.text}
          </p>
        ))}
        {error ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            {onRetry ? (
              <Button onClick={onRetry} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <RefreshCw size={14} className="mr-2" /> Retry
              </Button>
            ) : null}
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

function hasSegmentPlaybackAssets(segment: Segment, assets: Record<string, AudioAsset>) {
  if (!segment.resolvedAudio) {
    return {
      hasAllAssets: true,
      missingAssetIds: [] as string[],
    };
  }

  const missingAssetIds = new Set<string>();
  let hasMissingReferences = false;

  const narrationRefs = segment.resolvedAudio.narrationCues?.length
    ? segment.resolvedAudio.narrationCues.map((cue) => cue.assetId)
    : segment.resolvedAudio.narrationAssetId
      ? [segment.resolvedAudio.narrationAssetId]
      : [];

  if (segment.audioStatus.tts === "ready") {
    if (!narrationRefs.length) {
      hasMissingReferences = true;
    }

    narrationRefs.forEach((assetId) => {
      if (!assets[assetId]) {
        missingAssetIds.add(assetId);
      }
    });
  }

  segment.audioStatus.sfx.forEach((status, index) => {
    if (status !== "ready") {
      return;
    }

    const assetId = segment.resolvedAudio?.sfxAssetIds[index];

    if (!assetId) {
      hasMissingReferences = true;
      return;
    }

    if (!assets[assetId]) {
      missingAssetIds.add(assetId);
    }
  });

  if (segment.audioStatus.music === "ready") {
    const musicAssetId = segment.resolvedAudio.musicAssetId;

    if (!musicAssetId) {
      hasMissingReferences = true;
    } else if (!assets[musicAssetId]) {
      missingAssetIds.add(musicAssetId);
    }
  }

  return {
    hasAllAssets: !hasMissingReferences && missingAssetIds.size === 0,
    missingAssetIds: [...missingAssetIds],
  };
}

function StoryEndScreen({
  story,
  segments,
  assets,
  onContinue,
  onReplay,
  onHome,
}: {
  story: Story;
  segments: Segment[];
  assets: Record<string, AudioAsset>;
  onContinue: () => void;
  onReplay: () => void;
  onHome: () => void;
}) {
  const lang = useSettingsStore((state) => state.preferences.interfaceLang);
  const getReviewTitle = useCallback(
    (segment: Segment, previousSegment?: Segment) => {
      if (segment.audioScript.is_ending) {
        const endingTitle =
          segment.audioScript.ending_name ??
          story.endingName ??
          (lang === "zh" ? "未命名结局" : "Untitled Ending");
        return lang === "zh" ? `结局：${endingTitle}` : `Ending: ${endingTitle}`;
      }

      if (previousSegment?.audioScript.chapter_title === segment.audioScript.chapter_title) {
        return null;
      }

      return segment.audioScript.chapter_title;
    },
    [lang, story.endingName],
  );
  const assetCounts = Object.values(assets).reduce(
    (accumulator, asset) => {
      accumulator[asset.category] += 1;
      return accumulator;
    },
    { sfx: 0, music: 0, tts: 0 },
  );
  const cacheTotal = story.cacheHitCount + story.cacheMissCount;
  const cacheRate = cacheTotal ? `${Math.round((story.cacheHitCount / cacheTotal) * 100)}%` : "0%";
  const audioSummary = lang === "zh"
    ? `${assetCounts.sfx} 个音效 + ${assetCounts.music} 段配乐 + ${assetCounts.tts} 段旁白`
    : `${assetCounts.sfx} SFX + ${assetCounts.music} music tracks + ${assetCounts.tts} narration clips`;
  const cacheSummary = lang === "zh"
    ? `${cacheRate}（复用 ${story.cacheHitCount} / ${cacheTotal || 0} 次音效/配乐请求）`
    : `${cacheRate} (${story.cacheHitCount}/${cacheTotal || 0} SFX/music requests reused)`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
        <div className="flex justify-start">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onHome}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} className="mr-1" />
            {t("end.home", lang)}
          </Button>
        </div>

        <div className="space-y-3 text-center">
          <Clapperboard size={36} className="mx-auto text-accent" />
          <h1 className="text-2xl font-bold font-serif text-gradient-primary">「{story.title}」— {t("end.title", lang)}</h1>
          <p className="text-muted-foreground">{t("end.ending", lang)}: 「{story.endingName ?? (lang === "zh" ? "未命名结局" : "Untitled Ending")}」</p>
        </div>

        <div className="space-y-3 rounded-xl border border-border/50 p-5">
          <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5 text-muted-foreground"><Timer size={14} /> {t("end.duration", lang)}</span><span>{formatDuration(story.totalDurationSec)}</span></div>
          <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5 text-muted-foreground"><GitBranchIcon size={14} /> {t("end.decisions", lang)}</span><span>{story.totalDecisions}</span></div>
          <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5 text-muted-foreground"><Layers size={14} /> {t("end.audioLayers", lang)}</span><span>{audioSummary}</span></div>
          <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5 text-muted-foreground"><RefreshCw size={14} /> {t("end.cacheHit", lang)}</span><span>{cacheSummary}</span></div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{lang === "zh" ? "故事回顾" : "Story Review"}</h2>
          <div className="space-y-6">
            {segments.map((segment, index) => (
              <div key={`${segment.id}_${index}`} className="space-y-2">
                {(() => {
                  const reviewTitle = getReviewTitle(segment, segments[index - 1]);
                  return reviewTitle ? <h3 className="text-sm font-medium text-accent">{reviewTitle}</h3> : null;
                })()}
                <p className="font-serif text-sm leading-relaxed text-foreground/80">{segment.audioScript.narration.text}</p>
                {segment.choiceMade ? <p className="ml-1 border-l-2 border-accent/30 pl-3 text-xs text-muted-foreground">{lang === "zh" ? "你的选择：" : "Your choice: "} {segment.choiceMade.choiceText}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1 rounded-xl border border-border/50 p-4">
          <button onClick={onContinue} className="flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><RotateCcw size={14} /> {t("end.continue", lang)}</button>
          <button onClick={onReplay} className="flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><RefreshCw size={14} /> {t("end.replay", lang)}</button>
          <button onClick={() => void exportStoryAudioMp3(story, segments, assets)} className="flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Download size={14} /> {t("end.exportAudio", lang)}</button>
          <button onClick={() => exportStoryMarkdown(story, segments)} className="flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><FileText size={14} /> {t("end.exportText", lang)}</button>
          <button onClick={() => exportWorldJson(story)} className="flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Package size={14} /> {t("end.exportWorld", lang)}</button>
          <button onClick={onHome} className="flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Home size={14} /> {t("end.home", lang)}</button>
        </div>
      </div>
    </motion.div>
  );
}

export default function PlayerPage() {
  const router = useRouter();
  const params = useParams<{ storyId: string }>();
  const searchParams = useSearchParams();
  const storyId = params.storyId;
  const isSummaryView = searchParams.get("view") === "summary";
  const settings = useSettingsStore();
  const lang = settings.preferences.interfaceLang;
  const elevenlabsVerified = isElevenLabsVerified(settings.elevenlabs);
  const mixer = useMemo(() => getAudioMixer(), []);
  const choiceStartedAtRef = useRef<number | null>(null);
  const playbackSessionRef = useRef(0);
  const pausedSegmentAdvanceRef = useRef<string | null>(null);
  const lastAutoplayedSegmentRef = useRef<string | null>(null);
  const autoplayAttemptRef = useRef<{ segmentId: string; sessionId: number } | null>(null);
  const assetRecoveryAttemptRef = useRef<string | null>(null);
  const isAdvancingStoryRef = useRef(false);
  const isPausedRef = useRef(false);
  const worldPanelRef = useRef<HTMLDivElement | null>(null);
  const voicePanelRef = useRef<HTMLDivElement | null>(null);
  const volumePanelRef = useRef<HTMLDivElement | null>(null);

  const [story, setStory] = useState<Story | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [assetMap, setAssetMap] = useState<Record<string, AudioAsset>>({});
  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null);
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [narrationDuration, setNarrationDuration] = useState(0);
  const [narrationStartAtSec, setNarrationStartAtSec] = useState<number | null>(null);
  const [showChoices, setShowChoices] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(isSummaryView);
  const [loadingSteps, setLoadingSteps] = useState<LoadingOverlayStep[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [volumes, setVolumes] = useState<MixerVolumes>({ master: 1, narration: 1, sfx: 0.7, music: 0.4 });
  const [mutedLayers, setMutedLayers] = useState<Record<"tts" | "sfx" | "music", boolean>>({ tts: false, sfx: false, music: false });
  const [openPanel, setOpenPanel] = useState<"world" | "voice" | "volume" | null>(null);
  const [worldEditorValue, setWorldEditorValue] = useState("");
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [playingVoicePreview, setPlayingVoicePreview] = useState<string | null>(null);
  const [voiceGenderFilter, setVoiceGenderFilter] =
    useState<VoiceGenderFilter>("all");

  const mood = (currentSegment?.audioScript.mood_color ?? "mystery") as MoodType;
  const filteredVoices = filterVoicesByGender(
    availableVoices,
    voiceGenderFilter,
  );

  const showAdvanceStoryStage = useCallback(
    (stage: AdvanceStoryStage) => {
      setLoadingSteps(buildAdvanceStoryLoadingSteps(lang, stage));
    },
    [lang],
  );

  const setLoadingLines = useCallback(
    (lines: string[]) => {
      const initialAdvanceStorySteps = buildAdvanceStoryLoadingSteps(lang, "retrieval_context");
      const isAdvanceStoryOverlay =
        lines.length === initialAdvanceStorySteps.length &&
        lines.every((line, index) => line === initialAdvanceStorySteps[index]?.text);

      if (isAdvanceStoryOverlay) {
        setLoadingSteps(initialAdvanceStorySteps);
        return;
      }

      setLoadingSteps(
        lines.map((text, index) => ({
          text,
          state: index === lines.length - 1 ? "active" : "completed",
        })),
      );
    },
    [lang],
  );

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const reloadStory = useCallback(async () => {
    const loadedStory = await getStory(storyId);
    if (!loadedStory) {
      throw new Error(lang === "zh" ? "故事不存在" : "Story not found");
    }

    const loadedSegments = await listSegmentsByStory(storyId);
    const loadedAssets = await listStoryAssetMap(storyId);
    lastAutoplayedSegmentRef.current = null;
    autoplayAttemptRef.current = null;
    setStory(loadedStory);
    setSegments(loadedSegments);
    setAssetMap(loadedAssets);
    setCurrentSegment(loadedSegments[loadedSegments.length - 1] ?? null);
    setWorldEditorValue(JSON.stringify(loadedStory.worldState, null, 2));
    return { loadedStory, loadedSegments, loadedAssets };
  }, [lang, storyId]);

  const syncMixerVolumes = useCallback((nextVolumes: MixerVolumes, nextMuted = mutedLayers) => {
    mixer.setVolumes({
      master: nextVolumes.master,
      narration: nextMuted.tts ? 0 : nextVolumes.narration,
      sfx: nextMuted.sfx ? 0 : nextVolumes.sfx,
      music: nextMuted.music ? 0 : nextVolumes.music,
    });
  }, [mixer, mutedLayers]);
  const getPlaybackTimeSec = useCallback(() => mixer.getCurrentTime(), [mixer]);

  const generateSegment = async (
    options?: Parameters<typeof advanceStory>[2],
    sourceStory = story,
  ) => {
    if (!sourceStory || isAdvancingStoryRef.current) {
      return;
    }

    isAdvancingStoryRef.current = true;
    setLoadingError(null);
    setShowChoices(false);
    setIsLoading(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setIsNarrationPlaying(false);
    setNarrationStartAtSec(null);
    setNarrationDuration(0);
    playbackSessionRef.current += 1;
    pausedSegmentAdvanceRef.current = null;
    mixer.stopAll();
    setLoadingLines([
      lang === "zh" ? "正在检索世界上下文..." : "Retrieving world context...",
      lang === "zh" ? "正在生成叙事段落..." : "Generating the next segment...",
      lang === "zh" ? "正在解析音频层..." : "Resolving audio layers...",
    ]);

    try {
      const result = await advanceStory(
        {
          llm: settings.llm,
          elevenlabs: settings.elevenlabs,
          turbopuffer: settings.turbopuffer,
          voice: settings.voice,
          preferences: settings.preferences,
          customTags: settings.customTags,
          onboardingCompleted: settings.onboardingCompleted,
        },
        sourceStory,
        {
          ...options,
          onStageChange: showAdvanceStoryStage,
        },
      );

      const updatedSegments = await listSegmentsByStory(sourceStory.id);
      setStory(result.story);
      setSegments(updatedSegments);
      setAssetMap(result.assets);
      setIsPaused(false);
      isPausedRef.current = false;
      setIsNarrationPlaying(true);
      setCurrentSegment(result.segment);
      setWorldEditorValue(JSON.stringify(result.story.worldState, null, 2));
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setLoadingError(error instanceof Error ? error.message : "Unknown error");
      setIsLoading(false);
    } finally {
      isAdvancingStoryRef.current = false;
    }
  };

  const handleChoice = async (choiceId: string, freeText?: string) => {
    if (!story || !currentSegment || isLoading || isAdvancingStoryRef.current) {
      return;
    }

    const selectedChoice = currentSegment.audioScript.choices.find((choice) => choice.id === choiceId);
    const choiceText = freeText?.trim() || selectedChoice?.text || choiceId;
    const riskLevel = selectedChoice?.risk ?? "medium";
    const timeToDecideMs = choiceStartedAtRef.current ? Date.now() - choiceStartedAtRef.current : 0;

    await generateSegment({
      selectedAction: {
        choiceId,
        choiceText,
        riskLevel,
        isFreeText: Boolean(freeText?.trim()),
        timeToDecideMs,
      },
    });
  };

  const handleReplay = async () => {
    if (!story) {
      return;
    }

    const now = new Date().toISOString();
    const replayStory: Story = {
      ...story,
      id: createId("story"),
      status: "playing",
      currentChapter: story.worldState.chapters[0]?.id ?? "chapter_1",
      currentSegmentIndex: 0,
      endingName: undefined,
      continuedAfterEnding: false,
      createdAt: now,
      updatedAt: now,
      totalDurationSec: 0,
      totalDecisions: 0,
      cacheHitCount: 0,
      cacheMissCount: 0,
    };

    await putStory(replayStory);
    await putPlayerProfile(createEmptyPlayerProfile(replayStory.id));
    router.push(`/play/${replayStory.id}`);
  };

  const handleWorldSave = async () => {
    if (!story) {
      return;
    }

    try {
      const parsed = JSON.parse(worldEditorValue) as Story["worldState"];
      const nextStory = { ...story, worldState: parsed, updatedAt: new Date().toISOString() };
      await putStory(nextStory);
      setStory(nextStory);
      setOpenPanel(null);
      toast.success(lang === "zh" ? "世界设定已保存" : "World state saved");
    } catch {
      toast.error(lang === "zh" ? "世界 JSON 无法解析" : "World JSON is invalid");
    }
  };

  const handleWorldExport = () => {
    if (!story) {
      return;
    }

    exportWorldJson(story);
    setOpenPanel(null);
  };

  const handleVoicePreview = async (voiceId: string) => {
    if (playingVoicePreview) {
      setPlayingVoicePreview(null);
      return;
    }

    try {
      setPlayingVoicePreview(voiceId);
      const result = await previewElevenLabsVoice(settings.elevenlabs, voiceId, FALLBACK_PREVIEW_TEXT);
      const url = URL.createObjectURL(result.blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingVoicePreview(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setPlayingVoicePreview(null);
    }
  };

  const handlePauseToggle = useCallback(async () => {
    if (!currentSegment || isLoading) {
      return;
    }

    try {
      if (isPaused) {
        setIsPaused(false);
        isPausedRef.current = false;
        if (isNarrationPlaying) {
          await mixer.resume();
        }
        return;
      }

      if (isNarrationPlaying) {
        await mixer.pause();
      }

      setIsPaused(true);
      isPausedRef.current = true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : lang === "zh" ? "Pause failed" : "Pause failed");
    }
  }, [currentSegment, isLoading, isNarrationPlaying, isPaused, lang, mixer]);

  useEffect(() => {
    syncMixerVolumes(volumes);
  }, [syncMixerVolumes, volumes]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        setIsLoading(true);
        setLoadingLines([lang === "zh" ? "正在加载你的故事..." : "Loading your story..."]);
        const { loadedStory, loadedSegments } = await reloadStory();

        if (cancelled) {
          return;
        }

        if (loadedSegments.length === 0 && !isSummaryView) {
          const latestSettings = useSettingsStore.getState();
          setLoadingLines([
            lang === "zh" ? "正在检索世界上下文..." : "Retrieving world context...",
            lang === "zh" ? "正在生成叙事段落..." : "Generating the next segment...",
            lang === "zh" ? "正在解析音频层..." : "Resolving audio layers...",
          ]);
          const result = await advanceStory(
            {
              llm: latestSettings.llm,
              elevenlabs: latestSettings.elevenlabs,
              turbopuffer: latestSettings.turbopuffer,
              voice: latestSettings.voice,
              preferences: latestSettings.preferences,
              customTags: latestSettings.customTags,
              onboardingCompleted: latestSettings.onboardingCompleted,
            },
            loadedStory,
            {
              onStageChange: showAdvanceStoryStage,
            },
          );
          const updatedSegments = await listSegmentsByStory(loadedStory.id);

          if (cancelled) {
            return;
          }

          setStory(result.story);
          setSegments(updatedSegments);
          setAssetMap(result.assets);
          setIsPaused(false);
          isPausedRef.current = false;
          setIsNarrationPlaying(true);
          setCurrentSegment(result.segment);
          setWorldEditorValue(JSON.stringify(result.story.worldState, null, 2));
          setIsLoading(false);
          return;
        }

        setShowEndScreen(isSummaryView || loadedStory.status === "completed");
        setIsLoading(false);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setLoadingError(error instanceof Error ? error.message : "Unknown error");
          setIsLoading(false);
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
      mixer.stopAll();
    };
  }, [isSummaryView, lang, mixer, reloadStory, setLoadingLines, showAdvanceStoryStage]);

  useEffect(() => {
    if (!elevenlabsVerified) {
      setAvailableVoices([]);
      setIsLoadingVoices(false);
      return;
    }

    let cancelled = false;

    const syncVoices = async () => {
      setIsLoadingVoices(true);
      try {
        const voices = await listElevenLabsVoices(settings.elevenlabs);
        if (!cancelled) {
          setAvailableVoices(voices);
        }
      } catch {
        if (!cancelled) {
          setAvailableVoices([]);
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
  }, [elevenlabsVerified, settings.elevenlabs, settings.elevenlabs.apiKey, settings.elevenlabs.verifiedApiKey]);

  useEffect(() => {
    if (isPaused || !currentSegment) {
      return;
    }

    if (pausedSegmentAdvanceRef.current !== currentSegment.id) {
      return;
    }

    pausedSegmentAdvanceRef.current = null;

    if (currentSegment.audioScript.is_ending) {
      setShowEndScreen(true);
      return;
    }

    choiceStartedAtRef.current = Date.now();
    setShowChoices(true);
  }, [currentSegment, isPaused]);

  useEffect(() => {
    let cancelled = false;
    const sessionId = playbackSessionRef.current + 1;
    playbackSessionRef.current = sessionId;
    const playbackWaitController = new AbortController();
    let playbackStartTimeout: number | null = null;

    const playCurrentSegment = async () => {
      if (isLoading || !currentSegment || showEndScreen) {
        return;
      }

      if (lastAutoplayedSegmentRef.current === currentSegment.id) {
        return;
      }

      if (autoplayAttemptRef.current?.segmentId === currentSegment.id) {
        return;
      }

      autoplayAttemptRef.current = {
        segmentId: currentSegment.id,
        sessionId,
      };

      const playbackAssets = assetMap;
      const playbackAssetState = hasSegmentPlaybackAssets(currentSegment, playbackAssets);

      if (!playbackAssetState.hasAllAssets) {
        if (assetRecoveryAttemptRef.current !== currentSegment.id) {
          assetRecoveryAttemptRef.current = currentSegment.id;

          try {
            const refreshedAssets = await listStoryAssetMap(currentSegment.storyId);
            if (cancelled || playbackSessionRef.current !== sessionId) {
              return;
            }

            setAssetMap(refreshedAssets);
            return;
          } catch (error) {
            console.warn("Failed to refresh missing segment audio assets.", {
              segmentId: currentSegment.id,
              missingAssetIds: playbackAssetState.missingAssetIds,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        console.warn(
          "Segment audio assets still missing after refresh; continuing with available audio only.",
          {
            segmentId: currentSegment.id,
            missingAssetIds: playbackAssetState.missingAssetIds,
            audioStatus: currentSegment.audioStatus,
          },
        );
      } else {
        assetRecoveryAttemptRef.current = null;
      }

      pausedSegmentAdvanceRef.current = null;
      setShowChoices(false);
      setIsPaused(false);
      isPausedRef.current = false;
      setIsNarrationPlaying(true);
      setNarrationStartAtSec(null);
      setNarrationDuration(0);
      mixer.stopAll();
      const playbackStartedAtMs = Date.now();
      const estimatedNarrationDurationSec = Math.max(
        currentSegment.audioScript.narration.text.length / 18,
        6,
      );
      const playbackStartTimeoutMs = 5000;

      try {
        const result = currentSegment.resolvedAudio
          ? await Promise.race([
              mixer.playSegment(currentSegment, playbackAssets),
              new Promise<Awaited<ReturnType<typeof mixer.playSegment>>>((_, reject) => {
                playbackStartTimeout = window.setTimeout(() => {
                  reject(new Error("Segment playback start timed out"));
                }, playbackStartTimeoutMs);
              }),
            ])
          : {
              narrationDurationSec: 0,
              completion: Promise.resolve(),
            };
        if (playbackStartTimeout !== null) {
          window.clearTimeout(playbackStartTimeout);
          playbackStartTimeout = null;
        }
        if (cancelled || playbackSessionRef.current !== sessionId) {
          return;
        }

        lastAutoplayedSegmentRef.current = currentSegment.id;
        if (autoplayAttemptRef.current?.sessionId === sessionId) {
          autoplayAttemptRef.current = null;
        }

        const narrationDurationSec =
          result.narrationDurationSec || estimatedNarrationDurationSec;
        const hasNarrationAudio = Boolean(
          result.narrationDurationSec > 0 ||
            currentSegment.resolvedAudio?.narrationCues?.some(
              (cue) => playbackAssets[cue.assetId],
            ) ||
            (currentSegment.resolvedAudio?.narrationAssetId &&
              playbackAssets[currentSegment.resolvedAudio.narrationAssetId]),
        );

        setNarrationDuration(narrationDurationSec);
        setNarrationStartAtSec(result.narrationStartAtSec);

        if (!hasNarrationAudio) {
          await waitForActivePlaybackDuration({
            durationMs: Math.max(narrationDurationSec * 1000, 2500),
            isPausedRef,
            signal: playbackWaitController.signal,
          });
        } else {
          await waitForActivePlaybackDuration({
            durationMs: Math.max(narrationDurationSec * 1000 + 1500, 2500),
            isPausedRef,
            completion: result.completion,
            signal: playbackWaitController.signal,
            onTimeout: () => {
              console.warn(
                "Narration completion timed out; continuing to choices with duration fallback.",
                { segmentId: currentSegment.id },
              );
            },
          });
        }
        if (cancelled || playbackSessionRef.current !== sessionId) {
          return;
        }
      } catch (error) {
        console.error("Segment playback failed; continuing with duration fallback.", error);
        if (cancelled || playbackSessionRef.current !== sessionId) {
          return;
        }
        setNarrationDuration(estimatedNarrationDurationSec);
        setNarrationStartAtSec(null);
        mixer.stopAll();
        lastAutoplayedSegmentRef.current = currentSegment.id;
        if (autoplayAttemptRef.current?.sessionId === sessionId) {
          autoplayAttemptRef.current = null;
        }

        const elapsedMs = Date.now() - playbackStartedAtMs;
        const remainingMs = Math.max(
          estimatedNarrationDurationSec * 1000 - elapsedMs,
          0,
        );

        await waitForActivePlaybackDuration({
          durationMs: Math.max(remainingMs, 250),
          isPausedRef,
          signal: playbackWaitController.signal,
        });
        if (cancelled || playbackSessionRef.current !== sessionId) {
          return;
        }
      } finally {
        if (playbackStartTimeout !== null) {
          window.clearTimeout(playbackStartTimeout);
          playbackStartTimeout = null;
        }
      }

      setIsNarrationPlaying(false);

      if (isPausedRef.current) {
        pausedSegmentAdvanceRef.current = currentSegment.id;
        return;
      }

      setIsPaused(false);
      if (currentSegment.audioScript.is_ending) {
        setShowEndScreen(true);
        return;
      }
      choiceStartedAtRef.current = Date.now();
      setShowChoices(true);
    };

    void playCurrentSegment();
    return () => {
      cancelled = true;
      playbackWaitController.abort();
      if (playbackStartTimeout !== null) {
        window.clearTimeout(playbackStartTimeout);
      }
      if (playbackSessionRef.current === sessionId) {
        playbackSessionRef.current += 1;
      }
      if (autoplayAttemptRef.current?.sessionId === sessionId) {
        autoplayAttemptRef.current = null;
      }
      pausedSegmentAdvanceRef.current = null;
      isPausedRef.current = false;
      mixer.stopAll();
    };
  }, [assetMap, currentSegment, isLoading, mixer, showEndScreen]);

  useEffect(() => {
    if (!openPanel) {
      return;
    }

    const activePanelRef =
      openPanel === "world"
        ? worldPanelRef
        : openPanel === "voice"
          ? voicePanelRef
          : volumePanelRef;

    const handlePointerDown = (event: PointerEvent) => {
      if (activePanelRef.current?.contains(event.target as Node)) {
        return;
      }

      setOpenPanel(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openPanel]);

  const isWaveformAnimating = isNarrationPlaying && !isPaused;
  const audioLayers = useMemo(
    () => [
      {
        type: "sfx" as const,
        name: summarizeAudioLayerLabel({
          description: currentSegment?.audioScript.sfx_layers[0]?.description,
          type: "sfx",
          lang,
          mood,
        }),
        active: currentSegment?.audioStatus.sfx.some((status) => status === "ready") ?? false,
      },
      {
        type: "music" as const,
        name: summarizeAudioLayerLabel({
          description: currentSegment?.audioScript.music?.description,
          type: "music",
          lang,
          mood,
        }),
        active: currentSegment?.audioStatus.music === "ready",
      },
      { type: "tts" as const, name: t("player.narrating", lang), active: currentSegment?.audioStatus.tts === "ready" },
    ],
    [currentSegment, lang, mood],
  );

  const audioLayerIndicator = (
    <AudioLayerIndicator
      activeLayers={audioLayers}
      mutedLayers={mutedLayers}
      isAnimating={isWaveformAnimating}
      onToggle={(layer) => {
        const nextMuted = { ...mutedLayers, [layer]: !mutedLayers[layer] };
        setMutedLayers(nextMuted);
        syncMixerVolumes(volumes, nextMuted);
      }}
    />
  );

  if (!story) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">{lang === "zh" ? "加载故事中..." : "Loading story..."}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AtmosphericBackground mood={mood} />
      <LoadingOverlay open={isLoading} steps={loadingSteps} error={loadingError} onRetry={loadingError ? (() => void generateSegment()) : null} />

      <motion.div className="relative z-30 flex items-center justify-between border-b border-border/20 bg-background/30 px-4 py-3 backdrop-blur-md" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} className="mr-1" /> {t("player.exit", lang)}
          </Button>
          <span className="font-serif text-sm text-muted-foreground">{currentSegment?.audioScript.chapter_title ?? story.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <div ref={worldPanelRef} className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setOpenPanel((current) => current === "world" ? null : "world")}
            >
              <Edit3 size={14} /><span className="ml-1 hidden text-xs md:inline">{t("player.world", lang)}</span>
            </Button>
            {openPanel === "world" ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-[30rem] rounded-xl border border-border bg-background p-4 shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("player.world", lang)}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={handleWorldExport} className="text-xs text-muted-foreground">
                      <Package size={12} className="mr-1" /> {t("common.export", lang)}
                    </Button>
                    <Button size="sm" onClick={() => void handleWorldSave()} className="bg-accent text-accent-foreground hover:bg-accent/90">
                      <Save size={12} className="mr-1" /> {t("common.save", lang)}
                    </Button>
                  </div>
                </div>
                <textarea value={worldEditorValue} onChange={(event) => setWorldEditorValue(event.target.value)} className="min-h-[24rem] w-full rounded-lg border border-border bg-secondary/40 p-3 font-mono text-xs text-foreground outline-none" />
              </div>
            ) : null}
          </div>
          <div ref={voicePanelRef} className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setOpenPanel((current) => current === "voice" ? null : "voice")}
            >
              <Mic size={14} /><span className="ml-1 hidden text-xs md:inline">{t("player.voice", lang)}</span>
            </Button>
            {openPanel === "voice" ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 space-y-3 rounded-xl border border-border bg-background p-4 shadow-lg">
                <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("player.voice", lang)}</h3>
                {!elevenlabsVerified ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("elevenlabs.voiceLibraryPending", lang)}
                  </p>
                ) : isLoadingVoices ? (
                  <p className="text-xs text-muted-foreground">
                    {t("elevenlabs.loadingVoices", lang)}
                  </p>
                ) : availableVoices.length ? (
                  <div className="space-y-3">
                    <VoiceGenderTabs
                      lang={lang}
                      value={voiceGenderFilter}
                      onChange={setVoiceGenderFilter}
                    />
                    {filteredVoices.length ? (
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {filteredVoices.map((voiceOption) => (
                          <div
                            key={voiceOption.voice_id}
                            className={`w-full rounded-lg border p-3 text-sm ${
                              settings.voice.voiceId === voiceOption.voice_id
                                ? "border-accent/40 bg-accent/10 text-accent"
                                : "hover-surface border-border/40 text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  settings.updateVoice({
                                    voiceId: voiceOption.voice_id,
                                    voiceName: voiceOption.name,
                                    voiceDescription: "",
                                  })
                                }
                                className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                              >
                                <p className="font-medium">
                                  {getVoiceOptionDisplayName(voiceOption, lang)}
                                </p>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleVoicePreview(voiceOption.voice_id);
                                }}
                                className="rounded-full p-1 text-muted-foreground hover:bg-accent/10 hover:text-accent"
                              >
                                {playingVoicePreview === voiceOption.voice_id ? (
                                  <X size={14} />
                                ) : (
                                  <Volume2 size={14} />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {getEmptyVoiceFilterLabel(lang)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("elevenlabs.emptyVoices", lang)}
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <div ref={volumePanelRef} className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setOpenPanel((current) => current === "volume" ? null : "volume")}
            >
              <Volume2 size={14} /><span className="ml-1 hidden text-xs md:inline">{t("player.volume", lang)}</span>
            </Button>
            {openPanel === "volume" ? (
              <div className="absolute right-0 top-full z-50 mt-2">
                <VolumeControl volumes={volumes} onChange={(key, value) => {
                  const next = { ...volumes, [key]: value };
                  setVolumes(next);
                  syncMixerVolumes(next);
                }} />
              </div>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handlePauseToggle()}
            disabled={isLoading || !currentSegment}
            className="text-muted-foreground disabled:opacity-50"
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
            <span className="ml-1 hidden text-xs md:inline">
              {isPaused ? (lang === "zh" ? "继续" : "Resume") : (lang === "zh" ? "暂停" : "Pause")}
            </span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.confirm(t("player.endConfirm", lang)) && void generateSegment({ mode: "end_story" })} className="text-destructive/70 hover:bg-destructive/10 hover:text-destructive">
            <Square size={14} /><span className="ml-1 hidden text-xs md:inline">{t("player.end", lang)}</span>
          </Button>
        </div>
      </motion.div>

      <div className="relative z-20 flex flex-1 flex-col justify-start">
        <div className="pb-0 pt-6">
          <NarrationDisplay
            text={currentSegment?.audioScript.narration.text ?? ""}
            isPlaying={isNarrationPlaying}
            isPaused={isPaused}
            forceFullText={showChoices || showEndScreen}
            durationSec={narrationDuration}
            narrationStartAtSec={narrationStartAtSec}
            getPlaybackTimeSec={getPlaybackTimeSec}
          />
        </div>
        {isPaused ? (
          <p className="px-6 pt-4 text-center text-xs uppercase tracking-[0.28em] text-accent/80">
            {lang === "zh" ? "故事播放已暂停" : "Story playback paused"}
          </p>
        ) : null}
      </div>

      {!showChoices ? <div className="relative z-20">{audioLayerIndicator}</div> : null}

      <div className="relative z-20 pb-6 pt-4">
        <AnimatePresence>
          {showChoices && currentSegment ? (
            <ChoicePanel
              choices={currentSegment.audioScript.choices}
              onSelect={(choiceId, freeText) => void handleChoice(choiceId, freeText)}
              countdown={60}
              isPaused={isPaused}
              footer={audioLayerIndicator}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {showEndScreen ? (
        <StoryEndScreen
          story={story}
          segments={segments}
          assets={assetMap}
          onContinue={() => {
            setShowEndScreen(false);
            void generateSegment({ mode: "continue_after_ending" });
          }}
          onReplay={() => void handleReplay()}
          onHome={() => router.push("/")}
        />
      ) : null}
    </div>
  );
}
