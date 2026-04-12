"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { advanceStory, listStoryAssetMap } from "@/lib/engine/story-runtime";
import { isElevenLabsVerified, listElevenLabsVoices, previewElevenLabsVoice } from "@/lib/services/elevenlabs";
import type { AudioAsset, Segment, Story, VoiceOption } from "@/lib/types/echoverse";
import { createId, formatDuration } from "@/lib/utils/echoverse";
import { splitNarrationForReveal } from "@/lib/utils/narration";
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
  Package,
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

function NarrationDisplay({ text, isPlaying, durationSec }: { text: string; isPlaying: boolean; durationSec: number }) {
  const chunks = useMemo(() => splitNarrationForReveal(text), [text]);
  const [visibleChunks, setVisibleChunks] = useState(chunks.length);

  useEffect(() => {
    if (!isPlaying) {
      setVisibleChunks(chunks.length);
      return;
    }

    setVisibleChunks(0);
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
  }, [chunks, durationSec, isPlaying]);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-0">
      <p className="narration-text pb-0 leading-relaxed text-foreground/90">
        {chunks.slice(0, visibleChunks).join("")}
        {isPlaying && visibleChunks < chunks.length ? <span className="ml-1 inline-block h-5 w-[2px] animate-pulse bg-accent" /> : null}
      </p>
    </div>
  );
}

function AudioLayerIndicator({
  activeLayers,
  mutedLayers,
  onToggle,
}: {
  activeLayers: Array<{ type: "tts" | "sfx" | "music"; name: string; active: boolean }>;
  mutedLayers: Record<"tts" | "sfx" | "music", boolean>;
  onToggle: (layer: "tts" | "sfx" | "music") => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 px-4 py-2 text-muted-foreground">
      <div className="flex h-4 items-center gap-[1px]">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="wave-bar" style={{ animationDelay: `${index * 0.15}s`, height: `${6 + ((index * 5) % 10)}px` }} />
        ))}
      </div>
      {activeLayers.filter((layer) => layer.active).map((layer) => (
        <button
          key={layer.type}
          onClick={() => onToggle(layer.type)}
          className={`hover-surface rounded-full border px-3 py-1 text-xs transition-all ${
            mutedLayers[layer.type] ? "border-border/50 text-muted-foreground/60" : "border-accent/40 bg-accent/10 text-foreground"
          }`}
        >
          {layer.type === "sfx" ? <Volume1 size={12} className="mr-1 inline" /> : null}
          {layer.type === "music" ? <Music size={12} className="mr-1 inline" /> : null}
          {layer.type === "tts" ? <MessageCircle size={12} className="mr-1 inline" /> : null}
          {layer.name}
        </button>
      ))}
    </div>
  );
}

function ChoicePanel({
  choices,
  onSelect,
  countdown,
}: {
  choices: Segment["audioScript"]["choices"];
  onSelect: (choiceId: string, freeText?: string) => void;
  countdown: number;
}) {
  const lang = useSettingsStore((state) => state.preferences.interfaceLang);
  const [freeText, setFreeText] = useState("");
  const [timeLeft, setTimeLeft] = useState(countdown);
  const hasAutoSelectedRef = useRef(false);

  useEffect(() => {
    hasAutoSelectedRef.current = false;
    setTimeLeft(countdown);
    const timer = window.setInterval(() => {
      setTimeLeft((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [choices, countdown, onSelect]);

  useEffect(() => {
    if (timeLeft > 0 || hasAutoSelectedRef.current) {
      return;
    }

    hasAutoSelectedRef.current = true;
    onSelect(choices[0]?.id ?? "choice_1");
  }, [choices, onSelect, timeLeft]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
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
  }, [choices, onSelect]);

  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl space-y-3 px-4">
      {choices.map((choice, index) => (
        <button key={choice.id} onClick={() => onSelect(choice.id)} className="group w-full rounded-xl border border-border bg-card/60 p-4 text-left backdrop-blur-sm transition-all hover:border-accent/50 hover:bg-card/80">
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

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={freeText}
            onChange={(event) => setFreeText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && freeText.trim()) {
                onSelect("free", freeText);
              }
            }}
            placeholder={t("player.freeText", lang)}
            className="border-border bg-card/60 pr-12 backdrop-blur-sm"
          />
          <button onClick={() => freeText.trim() && onSelect("free", freeText.trim())} className="hover-icon-accent absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground">
            <Send size={16} />
          </button>
        </div>
      </div>

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

function LoadingOverlay({ open, lines, error, onRetry }: { open: boolean; lines: string[]; error: string | null; onRetry: (() => void) | null }) {
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
        {lines.map((line, index) => (
          <p key={`${line}_${index}`} className={`font-serif text-lg ${index === lines.length - 1 ? "text-foreground" : "text-muted-foreground"}`}>{line}</p>
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
  const assetCounts = Object.values(assets).reduce(
    (accumulator, asset) => {
      accumulator[asset.category] += 1;
      return accumulator;
    },
    { sfx: 0, music: 0, tts: 0 },
  );
  const cacheTotal = story.cacheHitCount + story.cacheMissCount;
  const cacheRate = cacheTotal ? `${Math.round((story.cacheHitCount / cacheTotal) * 100)}%` : "0%";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
        <div className="space-y-3 text-center">
          <Clapperboard size={36} className="mx-auto text-accent" />
          <h1 className="text-2xl font-bold font-serif text-gradient-primary">「{story.title}」— {t("end.title", lang)}</h1>
          <p className="text-muted-foreground">{t("end.ending", lang)}: 「{story.endingName ?? (lang === "zh" ? "未命名结局" : "Untitled Ending")}」</p>
        </div>

        <div className="space-y-3 rounded-xl border border-border/50 p-5">
          <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5 text-muted-foreground"><Timer size={14} /> {t("end.duration", lang)}</span><span>{formatDuration(story.totalDurationSec)}</span></div>
          <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5 text-muted-foreground"><GitBranchIcon size={14} /> {t("end.decisions", lang)}</span><span>{story.totalDecisions}</span></div>
          <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5 text-muted-foreground"><Layers size={14} /> {t("end.audioLayers", lang)}</span><span>{assetCounts.sfx} SFX + {assetCounts.music} Music + {assetCounts.tts} Narration</span></div>
          <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5 text-muted-foreground"><RefreshCw size={14} /> {t("end.cacheHit", lang)}</span><span>{cacheRate} ({story.cacheHitCount}/{cacheTotal || 0})</span></div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{lang === "zh" ? "故事回顾" : "Story Review"}</h2>
          <div className="space-y-6">
            {segments.map((segment, index) => (
              <div key={`${segment.id}_${index}`} className="space-y-2">
                <h3 className="text-sm font-medium text-accent">{segment.audioScript.chapter_title}</h3>
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
          <button onClick={() => exportWorldJson(story)} className="flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Package size={14} /> {lang === "zh" ? "导出世界数据" : "Export World Data"}</button>
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
  const settings = useSettingsStore();
  const lang = settings.preferences.interfaceLang;
  const elevenlabsVerified = isElevenLabsVerified(settings.elevenlabs);
  const mixer = useMemo(() => getAudioMixer(), []);
  const choiceStartedAtRef = useRef<number | null>(null);
  const initialWorldValueRef = useRef("");

  const [story, setStory] = useState<Story | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [assetMap, setAssetMap] = useState<Record<string, AudioAsset>>({});
  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null);
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false);
  const [narrationDuration, setNarrationDuration] = useState(0);
  const [showChoices, setShowChoices] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(searchParams.get("view") === "summary");
  const [loadingLines, setLoadingLines] = useState<string[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [volumes, setVolumes] = useState<MixerVolumes>({ master: 1, narration: 1, sfx: 0.7, music: 0.4 });
  const [mutedLayers, setMutedLayers] = useState<Record<"tts" | "sfx" | "music", boolean>>({ tts: false, sfx: false, music: false });
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isWorldOpen, setIsWorldOpen] = useState(false);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
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

  const reloadStory = useCallback(async () => {
    const loadedStory = await getStory(storyId);
    if (!loadedStory) {
      throw new Error(lang === "zh" ? "故事不存在" : "Story not found");
    }

    const loadedSegments = await listSegmentsByStory(storyId);
    const loadedAssets = await listStoryAssetMap(storyId);
    setStory(loadedStory);
    setSegments(loadedSegments);
    setAssetMap(loadedAssets);
    setCurrentSegment(loadedSegments[loadedSegments.length - 1] ?? null);
    setWorldEditorValue(JSON.stringify(loadedStory.worldState, null, 2));
    initialWorldValueRef.current = JSON.stringify(loadedStory.worldState, null, 2);
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

  const generateSegment = async (
    options?: Parameters<typeof advanceStory>[2],
    sourceStory = story,
  ) => {
    if (!sourceStory) {
      return;
    }

    setLoadingError(null);
    setShowChoices(false);
    setIsLoading(true);
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
        options,
      );

      const updatedSegments = await listSegmentsByStory(sourceStory.id);
      setStory(result.story);
      setSegments(updatedSegments);
      setAssetMap(result.assets);
      setCurrentSegment(result.segment);
      setWorldEditorValue(JSON.stringify(result.story.worldState, null, 2));
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setLoadingError(error instanceof Error ? error.message : "Unknown error");
      setIsLoading(false);
    }
  };

  const handleChoice = async (choiceId: string, freeText?: string) => {
    if (!story || !currentSegment) {
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
      setIsWorldOpen(false);
      toast.success(lang === "zh" ? "世界设定已保存" : "World state saved");
    } catch {
      toast.error(lang === "zh" ? "世界 JSON 无法解析" : "World JSON is invalid");
    }
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

        if (loadedSegments.length === 0 && searchParams.get("view") !== "summary") {
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
          );
          const updatedSegments = await listSegmentsByStory(loadedStory.id);

          if (cancelled) {
            return;
          }

          setStory(result.story);
          setSegments(updatedSegments);
          setAssetMap(result.assets);
          setCurrentSegment(result.segment);
          setWorldEditorValue(JSON.stringify(result.story.worldState, null, 2));
          setIsLoading(false);
          return;
        }

        setShowEndScreen(searchParams.get("view") === "summary" || loadedStory.status === "completed");
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
  }, [lang, mixer, reloadStory, searchParams]);

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
    let cancelled = false;

    const playCurrentSegment = async () => {
      if (!currentSegment || !currentSegment.resolvedAudio || showEndScreen) {
        return;
      }

      setShowChoices(false);
      setIsNarrationPlaying(true);
      const result = await mixer.playSegment(currentSegment, assetMap);
      if (cancelled) {
        return;
      }

      setNarrationDuration(result.narrationDurationSec || Math.max(currentSegment.audioScript.narration.text.length / 18, 6));
      await result.completion;
      if (cancelled) {
        return;
      }
      setIsNarrationPlaying(false);
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
    };
  }, [assetMap, currentSegment, mixer, showEndScreen]);

  const audioLayers = useMemo(
    () => [
      { type: "sfx" as const, name: currentSegment?.audioScript.sfx_layers[0]?.description || (lang === "zh" ? "音效" : "SFX"), active: currentSegment?.audioStatus.sfx.some((status) => status === "ready") ?? false },
      { type: "music" as const, name: currentSegment?.audioScript.music?.description || (lang === "zh" ? "配乐" : "Music"), active: currentSegment?.audioStatus.music === "ready" },
      { type: "tts" as const, name: t("player.narrating", lang), active: currentSegment?.audioStatus.tts === "ready" },
    ],
    [currentSegment, lang],
  );

  if (!story) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">{lang === "zh" ? "加载故事中..." : "Loading story..."}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AtmosphericBackground mood={mood} />
      <LoadingOverlay open={isLoading} lines={loadingLines} error={loadingError} onRetry={loadingError ? (() => void generateSegment()) : null} />

      <motion.div className="relative z-30 flex items-center justify-between border-b border-border/20 bg-background/30 px-4 py-3 backdrop-blur-md" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} className="mr-1" /> {t("player.exit", lang)}
          </Button>
          <span className="font-serif text-sm text-muted-foreground">{currentSegment?.audioScript.chapter_title ?? story.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setIsWorldOpen((open) => !open)}>
              <Edit3 size={14} /><span className="ml-1 hidden text-xs md:inline">{t("player.world", lang)}</span>
            </Button>
            {isWorldOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-[30rem] rounded-xl border border-border bg-background p-4 shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("player.world", lang)}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setWorldEditorValue(initialWorldValueRef.current)} className="text-xs text-muted-foreground">
                      <RefreshCw size={12} className="mr-1" /> Reset
                    </Button>
                    <Button size="sm" onClick={() => void handleWorldSave()} className="bg-accent text-accent-foreground hover:bg-accent/90">
                      <Save size={12} className="mr-1" /> Save
                    </Button>
                  </div>
                </div>
                <textarea value={worldEditorValue} onChange={(event) => setWorldEditorValue(event.target.value)} className="min-h-[24rem] w-full rounded-lg border border-border bg-secondary/40 p-3 font-mono text-xs text-foreground outline-none" />
              </div>
            ) : null}
          </div>
          <div className="relative">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setIsVoiceOpen((open) => !open)}>
              <Mic size={14} /><span className="ml-1 hidden text-xs md:inline">{t("player.voice", lang)}</span>
            </Button>
            {isVoiceOpen ? (
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
                          <button
                            key={voiceOption.voice_id}
                            onClick={() =>
                              settings.updateVoice({
                                voiceId: voiceOption.voice_id,
                                voiceName: voiceOption.name,
                                voiceDescription: "",
                              })
                            }
                            className={`w-full rounded-lg border p-3 text-left text-sm ${
                              settings.voice.voiceId === voiceOption.voice_id
                                ? "border-accent/40 bg-accent/10 text-accent"
                                : "hover-surface border-border/40 text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">
                                  {getVoiceOptionDisplayName(voiceOption, lang)}
                                </p>
                              </div>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
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
                          </button>
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
          <div className="relative">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setIsVolumeOpen((open) => !open)}>
              <Volume2 size={14} /><span className="ml-1 hidden text-xs md:inline">{t("player.volume", lang)}</span>
            </Button>
            {isVolumeOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2">
                <VolumeControl volumes={volumes} onChange={(key, value) => {
                  const next = { ...volumes, [key]: value };
                  setVolumes(next);
                  syncMixerVolumes(next);
                }} />
              </div>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={() => window.confirm(t("player.endConfirm", lang)) && void generateSegment({ mode: "end_story" })} className="text-destructive/70 hover:bg-destructive/10 hover:text-destructive">
            <Square size={14} /><span className="ml-1 hidden text-xs md:inline">{t("player.end", lang)}</span>
          </Button>
        </div>
      </motion.div>

      <div className="relative z-20 flex flex-1 flex-col justify-start">
        <div className="pb-0 pt-6">
          <NarrationDisplay text={currentSegment?.audioScript.narration.text ?? ""} isPlaying={isNarrationPlaying} durationSec={narrationDuration} />
        </div>
      </div>

      <div className="relative z-20">
        <AudioLayerIndicator
          activeLayers={audioLayers}
          mutedLayers={mutedLayers}
          onToggle={(layer) => {
            const nextMuted = { ...mutedLayers, [layer]: !mutedLayers[layer] };
            setMutedLayers(nextMuted);
            syncMixerVolumes(volumes, nextMuted);
          }}
        />
      </div>

      <div className="relative z-20 pb-6 pt-4">
        <AnimatePresence>
          {showChoices && currentSegment ? <ChoicePanel choices={currentSegment.audioScript.choices} onSelect={(choiceId, freeText) => void handleChoice(choiceId, freeText)} countdown={60} /> : null}
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
