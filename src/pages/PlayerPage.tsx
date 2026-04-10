import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { MOOD_MAP, type MoodType } from "@/lib/constants/moods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Volume2, Mic, Edit3, Square, Send, Volume1, Music, MessageCircle, Clapperboard, Timer, GitBranch as GitBranchIcon, Layers, RefreshCw, RotateCcw, Download, FileText, Package, Home } from "lucide-react";

// Sub-components

const AtmosphericBackground = ({ mood }: { mood: MoodType }) => {
  const config = MOOD_MAP[mood];
  return (
    <div className="fixed inset-0 transition-all duration-[3000ms]">
      <div
        className={`absolute inset-0 ${config.animation}`}
        style={{
          background: `linear-gradient(135deg, ${config.colors[0]}, ${config.colors[1]}, ${config.colors[2]})`,
          animationDuration: config.duration,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
    </div>
  );
};

const NarrationDisplay = ({ text, isTyping }: { text: string; isTyping: boolean }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!isTyping) { setDisplayedText(text); return; }
    setDisplayedText("");
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [text, isTyping]);

  return (
    <div className="max-w-2xl mx-auto w-full px-6 h-full overflow-y-auto">
      <p className="narration-text text-foreground/90 leading-relaxed pb-6">
        {displayedText}
        {isTyping && displayedText.length < text.length && (
          <span className="inline-block w-[2px] h-5 bg-accent ml-1 animate-pulse" />
        )}
      </p>
    </div>
  );
};

const AudioLayerIndicator = ({ layers }: { layers: { type: string; name: string; active: boolean }[] }) => (
  <div className="flex items-center justify-center gap-4 py-2 px-4 bg-secondary/30 backdrop-blur-sm">
    {/* Waveform */}
    <div className="flex items-center gap-[1px] h-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{ animationDelay: `${i * 0.15}s`, height: `${4 + Math.random() * 12}px` }}
        />
      ))}
    </div>
    {layers.filter((l) => l.active).map((l) => (
      <span key={l.type} className="text-xs text-muted-foreground flex items-center gap-1">
        {l.type === "sfx" && <Volume1 size={12} />}
        {l.type === "music" && <Music size={12} />}
        {l.type === "tts" && <MessageCircle size={12} />}
        {l.name}
      </span>
    ))}
  </div>
);

interface Choice {
  id: string;
  text: string;
  hint: string;
  label: string;
}

const ChoicePanel = ({
  choices,
  onSelect,
  countdown: initialCountdown,
}: {
  choices: Choice[];
  onSelect: (choiceId: string, text?: string) => void;
  countdown: number;
}) => {
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);
  const [freeText, setFreeText] = useState("");
  const [timeLeft, setTimeLeft] = useState(initialCountdown);

  useEffect(() => {
    setTimeLeft(initialCountdown);
    if (initialCountdown <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-select first choice when time runs out
          onSelect(choices[0]?.id || "free");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [initialCountdown, choices, onSelect]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto px-4 space-y-3"
    >
      {choices.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className="w-full text-left p-4 rounded-xl border border-border hover:border-accent/50 bg-card/60 backdrop-blur-sm transition-all hover:bg-card/80 group"
        >
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/20 text-accent flex items-center justify-center text-sm font-bold">
              {c.label}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">{c.text}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
            </div>
          </div>
        </button>
      ))}

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && freeText.trim()) onSelect("free", freeText); }}
            placeholder={t("player.freeText", lang)}
            className="bg-card/60 border-border backdrop-blur-sm pr-12"
          />
          <button
            onClick={() => { if (freeText.trim()) onSelect("free", freeText); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-accent"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {timeLeft > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          {t("player.autoSelect", lang)}: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
        </p>
      )}
    </motion.div>
  );
};

const VolumeControl = ({
  volumes,
  onChange,
}: {
  volumes: { master: number; narration: number; sfx: number; music: number };
  onChange: (key: string, val: number) => void;
}) => {
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);

  const sliders = [
    { key: "master", label: t("player.masterVolume", lang), icon: <Volume2 size={14} /> },
    { key: "narration", label: t("player.narrationVolume", lang), icon: <MessageCircle size={14} /> },
    { key: "sfx", label: t("player.sfxVolume", lang), icon: <Volume1 size={14} /> },
    { key: "music", label: t("player.musicVolume", lang), icon: <Music size={14} /> },
  ];

  return (
    <div className="w-64 p-4 glass-panel space-y-4">
      {sliders.map((s) => (
        <div key={s.key} className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{s.icon} {s.label}</span>
            <span>{Math.round((volumes[s.key as keyof typeof volumes]) * 100)}%</span>
          </div>
          <Slider
            value={[volumes[s.key as keyof typeof volumes] * 100]}
            onValueChange={([v]) => onChange(s.key, v / 100)}
            max={100}
            step={1}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
};

const StoryEndScreen = ({
  title,
  endingName,
  stats,
  onAction,
}: {
  title: string;
  endingName: string;
  stats: { duration: string; decisions: number; audioLayers: string; cacheHit: string };
  onAction: (action: string) => void;
}) => {
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-background/95 flex items-center justify-center z-50"
    >
      <div className="max-w-lg w-full mx-4 text-center space-y-6">
        <Clapperboard size={40} className="mx-auto mb-2 text-accent" />
        <h1 className="text-2xl font-bold font-serif text-gradient-primary">
          「{title}」— {t("end.title", lang)}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t("end.ending", lang)}: 「{endingName}」
        </p>

        <div className="glass-panel p-6 text-left space-y-3">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground flex items-center gap-1.5"><Timer size={14} /> {t("end.duration", lang)}</span><span>{stats.duration}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground flex items-center gap-1.5"><GitBranchIcon size={14} /> {t("end.decisions", lang)}</span><span>{stats.decisions}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground flex items-center gap-1.5"><Layers size={14} /> {t("end.audioLayers", lang)}</span><span>{stats.audioLayers}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground flex items-center gap-1.5"><RefreshCw size={14} /> {t("end.cacheHit", lang)}</span><span>{stats.duration}</span></div>
        </div>

        <div className="glass-panel p-4 space-y-2">
          {[
            { id: "continue", label: t("end.continue", lang) },
            { id: "replay", label: t("end.replay", lang) },
            { id: "exportAudio", label: t("end.exportAudio", lang) },
            { id: "exportText", label: t("end.exportText", lang) },
            { id: "exportWorld", label: t("end.exportWorld", lang) },
            { id: "home", label: t("end.home", lang) },
          ].map((action) => (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors text-sm"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// Main Player Page
const PlayerPage = () => {
  const navigate = useNavigate();
  const { storyId } = useParams();
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);
  const storyLang = useSettingsStore((s) => s.preferences.storyLang);

  const [mood, setMood] = useState<MoodType>("mystery");
  const [narrationText, setNarrationText] = useState(
    storyLang === "zh"
      ? "你缓缓睁开双眼。刺眼的荧光灯直射瞳孔。空气尝起来发霉，被循环了太多次。远处机器的低沉嗡鸣填满了寂静——这是一座本该在数年前就被废弃的空间站的心跳声。"
      : "You slowly open your eyes. The harsh fluorescent light stabs into your pupils. The air tastes stale, recycled too many times. A distant hum of machinery fills the silence — the heartbeat of a station that should have been abandoned years ago."
  );
  const [isTyping, setIsTyping] = useState(true);
  const [showChoices, setShowChoices] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showWorldPanel, setShowWorldPanel] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [chapterTitle, setChapterTitle] = useState(storyLang === "zh" ? "第一章：苏醒" : "Chapter 1: Awakening");
  const [volumes, setVolumes] = useState({ master: 1, narration: 1, sfx: 0.7, music: 0.4 });

  const audioLayers = [
    { type: "sfx", name: storyLang === "zh" ? "雨声" : "Rain", active: true },
    { type: "music", name: storyLang === "zh" ? "氛围音乐" : "Ambient", active: true },
    { type: "tts", name: t("player.narrating", lang), active: true },
  ];

  const choices: Choice[] = storyLang === "zh" ? [
    { id: "a", label: "A", text: "查看电脑终端", hint: "也许日志能解释发生了什么……" },
    { id: "b", label: "B", text: "沿着走廊追寻声音", hint: "还有其他人活着吗？" },
    { id: "c", label: "C", text: "尝试修复通讯手环", hint: "我需要让人知道我还活着" },
  ] : [
    { id: "a", label: "A", text: "Check the computer terminal", hint: "Maybe the logs can explain what happened..." },
    { id: "b", label: "B", text: "Follow the sound down the corridor", hint: "Is someone else still alive?" },
    { id: "c", label: "C", text: "Try to repair the comm bracelet", hint: "I need to let someone know I'm alive" },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTyping(false);
      setTimeout(() => setShowChoices(true), 1000);
    }, narrationText.length * 50 + 500);
    return () => clearTimeout(timer);
  }, [narrationText]);

  const handleChoice = useCallback((choiceId: string, text?: string) => {
    setShowChoices(false);
    setIsTyping(true);
    setMood("tension");
    setNarrationText(
      storyLang === "zh"
        ? (choiceId === "a"
          ? "你走近终端。屏幕在你触碰下闪烁亮起，投射出一片病态的绿色光芒。一行行文字飞速滚动——系统日志、船员名单、从未发送的求救信号。一条记录引起了你的注意……"
          : choiceId === "b"
          ? "你的脚步在走廊中回荡。那个声音越来越响——一种有节奏的敲击声，几乎是刻意的。当你转过拐角，应急灯将一切浸染成深红色……"
          : "你翻转手环。外壳已经碎裂，显示屏漆黑一片。但在表面之下，有一丝微弱的光脉冲——电池还有一点电量……")
        : (choiceId === "a"
          ? "You approach the terminal. Its screen flickers to life at your touch, casting a sickly green glow across your face. Lines of text scroll rapidly — system logs, crew manifests, distress signals that were never sent. One entry catches your eye..."
          : choiceId === "b"
          ? "Your footsteps echo through the corridor. The sound grows louder — a rhythmic tapping, almost deliberate. As you round the corner, the emergency lights bathe everything in crimson..."
          : "You turn the bracelet over in your hands. The casing is cracked, its display dark. But beneath the surface, a faint pulse of light — the power cell still holds a charge...")
    );
    setChapterTitle(storyLang === "zh" ? "第一章：发现" : "Chapter 1: Discovery");
    setTimeout(() => {
      setIsTyping(false);
      setTimeout(() => setShowChoices(true), 1000);
    }, 5000);
  }, []);

  const handleVolumeChange = (key: string, val: number) => {
    setVolumes((prev) => ({ ...prev, [key]: val }));
  };

  const handleEndStory = () => {
    if (window.confirm(t("player.endConfirm", lang))) {
      setShowEndScreen(true);
    }
  };

  const handleEndAction = (action: string) => {
    if (action === "home") navigate("/");
    else if (action === "continue") setShowEndScreen(false);
    else if (action === "replay") window.location.reload();
  };

  return (
    <div className="fixed inset-0 flex flex-col">
      <AtmosphericBackground mood={mood} />

      {/* Top bar */}
      <motion.div
        className="relative z-30 flex items-center justify-between px-4 py-3 bg-background/30 backdrop-blur-md border-b border-border/20"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            {t("player.exit", lang)}
          </Button>
          <span className="text-sm text-muted-foreground font-serif">{chapterTitle}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => { setShowWorldPanel(!showWorldPanel); setShowVoicePanel(false); setShowVolume(false); }} className="text-muted-foreground"><Edit3 size={14} /><span className="ml-1 text-xs hidden md:inline">{t("player.world", lang)}</span></Button>
            {showWorldPanel && (
              <div className="absolute top-full right-0 mt-2 z-50 glass-panel p-4 w-64 space-y-3">
                <h3 className="text-xs font-mono uppercase text-muted-foreground tracking-wider">{t("player.world", lang)}</h3>
                <div className="space-y-2 text-sm text-foreground/80">
                  <p><span className="text-muted-foreground">{storyLang === "zh" ? "地点：" : "Location: "}</span>{storyLang === "zh" ? "废弃空间站 · 第7区" : "Abandoned Station · Sector 7"}</p>
                  <p><span className="text-muted-foreground">{storyLang === "zh" ? "时间：" : "Time: "}</span>{storyLang === "zh" ? "未知（系统时钟损坏）" : "Unknown (system clock damaged)"}</p>
                  <p><span className="text-muted-foreground">{storyLang === "zh" ? "氛围：" : "Mood: "}</span>{storyLang === "zh" ? "紧张 · 神秘" : "Tense · Mysterious"}</p>
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => { setShowVoicePanel(!showVoicePanel); setShowWorldPanel(false); setShowVolume(false); }} className="text-muted-foreground"><Mic size={14} /><span className="ml-1 text-xs hidden md:inline">{t("player.voice", lang)}</span></Button>
            {showVoicePanel && (
              <div className="absolute top-full right-0 mt-2 z-50 glass-panel p-4 w-64 space-y-3">
                <h3 className="text-xs font-mono uppercase text-muted-foreground tracking-wider">{t("player.voice", lang)}</h3>
                <div className="space-y-2 text-sm text-foreground/80">
                  <p><span className="text-muted-foreground">{storyLang === "zh" ? "当前声音：" : "Current voice: "}</span>{storyLang === "zh" ? "默认旁白" : "Default Narrator"}</p>
                  <p><span className="text-muted-foreground">{storyLang === "zh" ? "语速：" : "Speed: "}</span>1.0x</p>
                  <p><span className="text-muted-foreground">{storyLang === "zh" ? "稳定性：" : "Stability: "}</span>0.5</p>
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => { setShowVolume(!showVolume); setShowWorldPanel(false); setShowVoicePanel(false); }} className="text-muted-foreground">
              <Volume2 size={14} /><span className="ml-1 text-xs hidden md:inline">{t("player.volume", lang)}</span>
            </Button>
            {showVolume && (
              <div className="absolute top-full right-0 mt-2 z-50">
                <VolumeControl volumes={volumes} onChange={handleVolumeChange} />
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleEndStory} className="text-destructive/70 hover:text-destructive">
            <Square size={14} /><span className="ml-1 text-xs hidden md:inline">{t("player.end", lang)}</span>
          </Button>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="relative z-20 flex-1 min-h-0 flex flex-col justify-center">
        <div className="flex-1 min-h-0 py-8">
          <NarrationDisplay text={narrationText} isTyping={isTyping} />
        </div>
      </div>

      {/* Audio layer indicator */}
      <div className="relative z-20">
        <AudioLayerIndicator layers={audioLayers} />
      </div>

      {/* Choice panel */}
      <div className="relative z-20 pb-6 pt-4">
        <AnimatePresence>
          {showChoices && (
            <ChoicePanel
              choices={choices}
              onSelect={handleChoice}
              countdown={45}
            />
          )}
        </AnimatePresence>
      </div>

      {/* End screen */}
      {showEndScreen && (
        <StoryEndScreen
          title={storyLang === "zh" ? "回声空间站" : "Echo Station"}
          endingName={storyLang === "zh" ? "共生" : "Symbiosis"}
          stats={{
            duration: "23:47",
            decisions: 7,
            audioLayers: storyLang === "zh" ? "32 音效 + 6 配乐 + 10 旁白" : "32 SFX + 6 Music + 10 Narration",
            cacheHit: "42% (13/31)",
          }}
          onAction={handleEndAction}
        />
      )}
    </div>
  );
};

export default PlayerPage;
