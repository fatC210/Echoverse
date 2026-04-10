import { useState, useEffect, useCallback, useMemo } from "react";
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

const AtmosphericBackground = () => {
  return (
    <div className="fixed inset-0 bg-black" />
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
    <div className="max-w-2xl mx-auto w-full px-6 pb-0">
      <p className="narration-text text-foreground/90 leading-relaxed pb-0">
        {displayedText}
        {isTyping && displayedText.length < text.length && (
          <span className="inline-block w-[2px] h-5 bg-accent ml-1 animate-pulse" />
        )}
      </p>
    </div>
  );
};

const WAVE_HEIGHTS = [8, 14, 6, 16, 10, 12, 7, 15];

const AudioLayerIndicator = ({ layers }: { layers: { type: string; name: string; active: boolean }[] }) => (
  <div className="flex items-center justify-center gap-4 px-4 py-1 text-muted-foreground">
    <div className="flex items-center gap-[1px] h-4">
      {WAVE_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{ animationDelay: `${i * 0.15}s`, height: `${h}px` }}
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
          const randomChoice = choices[Math.floor(Math.random() * choices.length)];
          onSelect(randomChoice?.id || "free");
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
    <div className="w-64 p-4 bg-background border border-border rounded-xl shadow-lg space-y-4">
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

interface StoryEntry {
  chapter: string;
  narration: string;
  choiceText?: string;
}

const StoryEndScreen = ({
  title,
  endingName,
  stats,
  storyLog,
  onAction,
}: {
  title: string;
  endingName: string;
  stats: { duration: string; decisions: number; audioLayers: string; cacheHit: string };
  storyLog: StoryEntry[];
  onAction: (action: string) => void;
}) => {
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-background z-50 overflow-y-auto"
    >
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <Clapperboard size={36} className="mx-auto text-accent" />
          <h1 className="text-2xl font-bold font-serif text-gradient-primary">
            「{title}」— {t("end.title", lang)}
          </h1>
          <p className="text-muted-foreground">
            {t("end.ending", lang)}: 「{endingName}」
          </p>
        </div>

        {/* Stats */}
        <div className="border border-border/50 rounded-xl p-5 space-y-3">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground flex items-center gap-1.5"><Timer size={14} /> {t("end.duration", lang)}</span><span>{stats.duration}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground flex items-center gap-1.5"><GitBranchIcon size={14} /> {t("end.decisions", lang)}</span><span>{stats.decisions}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground flex items-center gap-1.5"><Layers size={14} /> {t("end.audioLayers", lang)}</span><span>{stats.audioLayers}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground flex items-center gap-1.5"><RefreshCw size={14} /> {t("end.cacheHit", lang)}</span><span>{stats.cacheHit}</span></div>
        </div>

        {/* Story Review */}
        <div className="space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {lang === "zh" ? "故事回顾" : "Story Review"}
          </h2>
          <div className="space-y-6">
            {storyLog.map((entry, i) => (
              <div key={i} className="space-y-2">
                <h3 className="text-sm font-medium text-accent">{entry.chapter}</h3>
                <p className="text-sm text-foreground/80 leading-relaxed font-serif">{entry.narration}</p>
                {entry.choiceText && (
                  <p className="text-xs text-muted-foreground border-l-2 border-accent/30 pl-3 ml-1">
                    {lang === "zh" ? "你的选择：" : "Your choice: "}{entry.choiceText}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="border border-border/50 rounded-xl p-4 space-y-1">
          {[
            { id: "continue", label: t("end.continue", lang), icon: <RotateCcw size={14} /> },
            { id: "replay", label: t("end.replay", lang), icon: <RefreshCw size={14} /> },
            { id: "exportAudio", label: t("end.exportAudio", lang), icon: <Download size={14} /> },
            { id: "exportText", label: t("end.exportText", lang), icon: <FileText size={14} /> },
            { id: "home", label: t("end.home", lang), icon: <Home size={14} /> },
          ].map((action) => (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors text-sm flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              {action.icon}
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
  const [currentSceneId, setCurrentSceneId] = useState("start");

  // Shuffle and pick N items from array
  const pickRandom = useCallback(<T,>(arr: T[], n: number): T[] => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }, []);

  type ChoiceItem = { id: string; label: string; text: string; hint: string; next?: string };

  // Scene graph: each scene has 5 choices, we randomly pick 3
  const sceneGraph: Record<string, {
    narration: string; chapter: string; mood: MoodType;
    choices: ChoiceItem[];
  }> = useMemo(() => storyLang === "zh" ? {
    start: {
      narration: "你缓缓睁开双眼。刺眼的荧光灯直射瞳孔。空气尝起来发霉，被循环了太多次。远处机器的低沉嗡鸣填满了寂静——这是一座本该在数年前就被废弃的空间站的心跳声。",
      chapter: "第一章：苏醒", mood: "mystery",
      choices: [
        { id: "a", label: "A", text: "查看电脑终端", hint: "也许日志能解释发生了什么……", next: "terminal" },
        { id: "b", label: "B", text: "沿着走廊追寻声音", hint: "还有其他人活着吗？", next: "corridor" },
        { id: "c", label: "C", text: "尝试修复通讯手环", hint: "我需要让人知道我还活着", next: "bracelet" },
        { id: "d", label: "D", text: "检查自己的身体状况", hint: "我的头很痛……发生了什么？", next: "terminal" },
        { id: "e", label: "E", text: "寻找最近的逃生舱", hint: "先确保有退路", next: "corridor" },
      ],
    },
    terminal: {
      narration: "你走近终端。屏幕在你触碰下闪烁亮起，投射出一片病态的绿色光芒。一行行文字飞速滚动——系统日志、船员名单、从未发送的求救信号。一条记录引起了你的注意：「生物样本突破收容——全员撤离」。日期显示是三年前。",
      chapter: "第二章：发现", mood: "tension",
      choices: [
        { id: "a", label: "A", text: "搜索更多日志记录", hint: "真相或许藏在数据中……", next: "logs" },
        { id: "b", label: "B", text: "前往生物实验室", hint: "被收容的到底是什么？", next: "lab" },
        { id: "c", label: "C", text: "启动紧急广播系统", hint: "也许有人还在监听", next: "broadcast" },
        { id: "d", label: "D", text: "查找船员生存记录", hint: "有没有人还活着？", next: "logs" },
        { id: "e", label: "E", text: "下载数据到便携设备", hint: "先备份证据再说", next: "broadcast" },
      ],
    },
    corridor: {
      narration: "你的脚步在走廊中回荡。那个声音越来越响——一种有节奏的敲击声，几乎是刻意的。当你转过拐角，应急灯将一切浸染成深红色。一个身影蜷缩在墙角，正用指关节有规律地敲击金属管道。",
      chapter: "第二章：回声", mood: "tension",
      choices: [
        { id: "a", label: "A", text: "靠近并呼唤对方", hint: "也许他需要帮助", next: "survivor" },
        { id: "b", label: "B", text: "保持距离观察", hint: "先确认安全再说", next: "observe" },
        { id: "c", label: "C", text: "悄悄离开", hint: "直觉告诉你这里不安全", next: "flee" },
        { id: "d", label: "D", text: "用手电筒照向对方", hint: "先看清楚再做决定", next: "observe" },
        { id: "e", label: "E", text: "模仿他的敲击节奏", hint: "也许这是某种暗号", next: "survivor" },
      ],
    },
    bracelet: {
      narration: "你翻转手环。外壳已经碎裂，显示屏漆黑一片。但在表面之下，有一丝微弱的光脉冲——电池还有一点电量。你用指甲小心翼翼地撬开后盖，里面的电路板上覆盖着一层异样的霜花。",
      chapter: "第二章：微光", mood: "mystery",
      choices: [
        { id: "a", label: "A", text: "尝试短路重启", hint: "也许能发出一次信号", next: "signal" },
        { id: "b", label: "B", text: "检查霜花来源", hint: "这不像是普通的结冰……", next: "frost" },
        { id: "c", label: "C", text: "拆下电池另作他用", hint: "也许有更需要电力的地方", next: "battery" },
        { id: "d", label: "D", text: "用体温融化霜花", hint: "也许能恢复电路功能", next: "frost" },
        { id: "e", label: "E", text: "寻找其他通讯设备", hint: "这个手环可能无法修复", next: "signal" },
      ],
    },
    logs: {
      narration: "你深入日志的深处。大部分文件已损坏，但你拼凑出了真相：三年前，站上发现了一种寄生性的外星有机体。它不攻击宿主——它与宿主融合，改写神经网络。最后一条日志写道：「它不是入侵者，它在尝试交流。」",
      chapter: "第三章：真相", mood: "wonder",
      choices: [
        { id: "a", label: "A", text: "寻找有机体样本", hint: "如果它想交流，也许我应该回应" },
        { id: "b", label: "B", text: "删除所有数据并撤离", hint: "有些知识太危险了" },
        { id: "c", label: "C", text: "将数据发送至地球", hint: "让人类自己做决定" },
        { id: "d", label: "D", text: "寻找最后幸存的船员", hint: "也许有人与它成功交流过" },
        { id: "e", label: "E", text: "在日志中搜索弱点", hint: "以防需要摧毁它" },
      ],
    },
    lab: {
      narration: "实验室的门在你面前缓缓滑开。一阵冰冷的空气扑面而来，带着甲醛和某种你无法辨识的甜腻气味。破碎的培养皿散落一地，墙壁上布满了某种深色的藤蔓状物质。它们似乎在……呼吸。",
      chapter: "第三章：活物", mood: "horror",
      choices: [
        { id: "a", label: "A", text: "采集藤蔓样本", hint: "了解你的敌人" },
        { id: "b", label: "B", text: "立即撤退并封锁实验室", hint: "有些东西不该被打扰" },
        { id: "c", label: "C", text: "尝试与它沟通", hint: "它在呼吸……也许它有意识？" },
        { id: "d", label: "D", text: "用火焰灼烧藤蔓", hint: "把它们全部烧掉" },
        { id: "e", label: "E", text: "记录它们的生长规律", hint: "也许能找到控制它的方法" },
      ],
    },
    broadcast: {
      narration: "广播系统嘎吱作响地启动了。你的声音回荡在空荡的频道里。沉默了漫长的三十秒后，耳机里传来一个声音——不是人类的语言，而是一种低沉的、有节律的脉冲。它在回应你。",
      chapter: "第三章：信号", mood: "wonder",
      choices: [
        { id: "a", label: "A", text: "模仿它的节律回应", hint: "也许这是某种语言" },
        { id: "b", label: "B", text: "切断广播并逃离", hint: "不知道对面是什么" },
        { id: "c", label: "C", text: "发送地球坐标", hint: "无论是什么，让它知道我们在哪" },
        { id: "d", label: "D", text: "录下脉冲信号", hint: "带回去分析" },
        { id: "e", label: "E", text: "尝试用数学公式回复", hint: "数学是宇宙通用语言" },
      ],
    },
    survivor: {
      narration: "那个身影抬起了头。他的眼神空洞，嘴唇干裂，但还活着。他的制服上写着「陈博士——首席生物学家」。他用沙哑的声音说：「你不应该来这里。它已经醒了。它一直在等——等一个新的宿主。」",
      chapter: "第三章：幸存者", mood: "dread",
      choices: [
        { id: "a", label: "A", text: "询问「它」是什么", hint: "也许他知道真相" },
        { id: "b", label: "B", text: "带他一起离开", hint: "先撤离再说" },
        { id: "c", label: "C", text: "检查他是否已被感染", hint: "他看起来不太对劲……" },
        { id: "d", label: "D", text: "给他水和食物", hint: "他看起来快要虚脱了" },
        { id: "e", label: "E", text: "询问其他船员的下落", hint: "也许还有其他人活着" },
      ],
    },
    observe: {
      narration: "你屏住呼吸，藏在拐角后观察。那个身影突然停止了敲击，缓缓转过头。他的半张脸已经被一层银色的、金属般的物质覆盖。那物质在呼吸，像一层活着的面具。他微笑了——至少，那看起来像微笑。",
      chapter: "第三章：共生体", mood: "horror",
      choices: [
        { id: "a", label: "A", text: "转身逃跑", hint: "这不是人类了" },
        { id: "b", label: "B", text: "试图交谈", hint: "他……它似乎没有敌意" },
        { id: "c", label: "C", text: "寻找武器", hint: "以防万一" },
        { id: "d", label: "D", text: "用灯光照射它", hint: "看看它对光有什么反应" },
        { id: "e", label: "E", text: "拍下照片留作证据", hint: "无论发生什么，要留下记录" },
      ],
    },
    flee: {
      narration: "你转身就跑。身后传来一阵轻柔的、几乎是温柔的叹息声。走廊里的灯光开始一盏接一盏地熄灭——不是坏了，而是被什么东西遮住了。空气中弥漫着那种甜腻的气味。",
      chapter: "第三章：黑暗", mood: "dread",
      choices: [
        { id: "a", label: "A", text: "继续跑向逃生舱", hint: "不管了，先离开这里" },
        { id: "b", label: "B", text: "躲进最近的舱室", hint: "也许它会错过你" },
        { id: "c", label: "C", text: "停下来面对它", hint: "逃跑似乎没有用" },
        { id: "d", label: "D", text: "制造噪音吸引它到别处", hint: "声东击西" },
        { id: "e", label: "E", text: "启动走廊的应急照明", hint: "也许光能驱退它" },
      ],
    },
    signal: {
      narration: "你将两根裸露的导线碰在一起。火花溅射的瞬间，手环发出了一声尖锐的电子哨音——然后整个空间站的灯光闪烁了一下。某处深处传来一声低吼，像是巨大的金属结构在呻吟。你的信号被听到了……但不只被你期望的对象听到。",
      chapter: "第三章：觉醒", mood: "tension",
      choices: [
        { id: "a", label: "A", text: "循着声音去查看", hint: "必须知道发生了什么" },
        { id: "b", label: "B", text: "立即前往逃生舱", hint: "时间不多了" },
        { id: "c", label: "C", text: "再次发送信号", hint: "也许能与外界取得联系" },
        { id: "d", label: "D", text: "关闭所有电力系统", hint: "让一切恢复沉寂" },
        { id: "e", label: "E", text: "用手环追踪信号源", hint: "找到它的位置" },
      ],
    },
    frost: {
      narration: "你用手指轻触那层霜花。它不冷——事实上，它是温热的。在你的触碰下，那些晶体开始缓慢移动，像是有生命的雪花。它们顺着你的指尖向上蔓延，在你的皮肤上留下一串微弱的蓝色荧光。不痛，反而有一种奇异的安宁感。",
      chapter: "第三章：接触", mood: "wonder",
      choices: [
        { id: "a", label: "A", text: "让它继续蔓延", hint: "也许这就是「它」交流的方式" },
        { id: "b", label: "B", text: "甩掉并后退", hint: "不知道这东西会做什么" },
        { id: "c", label: "C", text: "对着它说话", hint: "如果它有意识，也许能理解" },
        { id: "d", label: "D", text: "闭上眼睛感受它", hint: "放下戒备，用心感知" },
        { id: "e", label: "E", text: "引导它蔓延到手环上", hint: "也许它能修复设备" },
      ],
    },
    battery: {
      narration: "你小心地取出微型电池。它比你想象的要热。当你将它从手环中抽离的瞬间，空间站的某处传来一声沉闷的「咚」——像是心跳。然后又一声。又一声。整座空间站似乎苏醒了过来。",
      chapter: "第三章：心跳", mood: "dread",
      choices: [
        { id: "a", label: "A", text: "把电池装回去", hint: "也许取出电池触发了什么" },
        { id: "b", label: "B", text: "带着电池前往控制室", hint: "也许能用它启动什么" },
        { id: "c", label: "C", text: "丢掉电池并逃跑", hint: "这东西不对劲" },
        { id: "d", label: "D", text: "跟随心跳声寻找源头", hint: "它来自空间站深处" },
        { id: "e", label: "E", text: "用电池给通讯系统供电", hint: "最后的机会发出求救信号" },
      ],
    },
  } : {
    start: {
      narration: "You slowly open your eyes. The harsh fluorescent light stabs into your pupils. The air tastes stale, recycled too many times. A distant hum of machinery fills the silence — the heartbeat of a station that should have been abandoned years ago.",
      chapter: "Chapter 1: Awakening", mood: "mystery",
      choices: [
        { id: "a", label: "A", text: "Check the computer terminal", hint: "Maybe the logs can explain what happened...", next: "terminal" },
        { id: "b", label: "B", text: "Follow the sound down the corridor", hint: "Is someone else still alive?", next: "corridor" },
        { id: "c", label: "C", text: "Try to repair the comm bracelet", hint: "I need to let someone know I'm alive", next: "bracelet" },
        { id: "d", label: "D", text: "Check your physical condition", hint: "My head hurts... what happened?", next: "terminal" },
        { id: "e", label: "E", text: "Find the nearest escape pod", hint: "Better have an exit plan first", next: "corridor" },
      ],
    },
    terminal: {
      narration: "You approach the terminal. Its screen flickers to life at your touch, casting a sickly green glow across your face. Lines of text scroll rapidly — system logs, crew manifests, distress signals that were never sent. One entry catches your eye: 'Biological sample containment breach — all personnel evacuate.' The date reads three years ago.",
      chapter: "Chapter 2: Discovery", mood: "tension",
      choices: [
        { id: "a", label: "A", text: "Search for more log entries", hint: "The truth might be hidden in the data...", next: "logs" },
        { id: "b", label: "B", text: "Head to the bio-lab", hint: "What exactly was contained?", next: "lab" },
        { id: "c", label: "C", text: "Activate the emergency broadcast", hint: "Maybe someone is still listening", next: "broadcast" },
        { id: "d", label: "D", text: "Search for crew survival records", hint: "Is anyone still alive?", next: "logs" },
        { id: "e", label: "E", text: "Download data to a portable device", hint: "Back up the evidence first", next: "broadcast" },
      ],
    },
    corridor: {
      narration: "Your footsteps echo through the corridor. The sound grows louder — a rhythmic tapping, almost deliberate. As you round the corner, emergency lights bathe everything in crimson. A figure is curled against the wall, knocking their knuckles against a metal pipe in a steady rhythm.",
      chapter: "Chapter 2: Echo", mood: "tension",
      choices: [
        { id: "a", label: "A", text: "Approach and call out", hint: "Maybe they need help", next: "survivor" },
        { id: "b", label: "B", text: "Observe from a distance", hint: "Better safe than sorry", next: "observe" },
        { id: "c", label: "C", text: "Quietly leave", hint: "Your instincts say it's not safe", next: "flee" },
        { id: "d", label: "D", text: "Shine your flashlight at them", hint: "Get a clear look first", next: "observe" },
        { id: "e", label: "E", text: "Mimic their tapping rhythm", hint: "Maybe it's some kind of code", next: "survivor" },
      ],
    },
    bracelet: {
      narration: "You turn the bracelet over in your hands. The casing is cracked, its display dark. But beneath the surface, a faint pulse of light — the power cell still holds a charge. You carefully pry open the back cover with your fingernail. The circuit board inside is covered with an unusual frost.",
      chapter: "Chapter 2: Glimmer", mood: "mystery",
      choices: [
        { id: "a", label: "A", text: "Try a short-circuit reboot", hint: "Maybe you can send one signal", next: "signal" },
        { id: "b", label: "B", text: "Examine the frost", hint: "This doesn't look like normal ice...", next: "frost" },
        { id: "c", label: "C", text: "Remove the battery for other use", hint: "Maybe something else needs power more", next: "battery" },
        { id: "d", label: "D", text: "Warm it with body heat", hint: "Maybe the circuit will recover", next: "frost" },
        { id: "e", label: "E", text: "Look for another comm device", hint: "This one might be beyond repair", next: "signal" },
      ],
    },
    logs: {
      narration: "You dig deep into the logs. Most files are corrupted, but you piece together the truth: three years ago, the station discovered a parasitic alien organism. It doesn't attack its host — it merges with them, rewriting neural networks. The last log entry reads: 'It's not an invader. It's trying to communicate.'",
      chapter: "Chapter 3: The Truth", mood: "wonder",
      choices: [
        { id: "a", label: "A", text: "Seek out the organism", hint: "If it wants to communicate, maybe I should respond" },
        { id: "b", label: "B", text: "Delete all data and evacuate", hint: "Some knowledge is too dangerous" },
        { id: "c", label: "C", text: "Transmit data to Earth", hint: "Let humanity decide" },
        { id: "d", label: "D", text: "Find the last surviving crew", hint: "Maybe someone successfully communicated with it" },
        { id: "e", label: "E", text: "Search the logs for weaknesses", hint: "In case you need to destroy it" },
      ],
    },
    lab: {
      narration: "The laboratory door slides open slowly. A wave of cold air hits you, carrying formaldehyde and something sweet you can't identify. Shattered specimen jars litter the floor, and dark vine-like growths cover the walls. They seem to be... breathing.",
      chapter: "Chapter 3: The Living", mood: "horror",
      choices: [
        { id: "a", label: "A", text: "Collect a vine sample", hint: "Know your enemy" },
        { id: "b", label: "B", text: "Retreat and seal the lab", hint: "Some things should stay undisturbed" },
        { id: "c", label: "C", text: "Try to communicate with it", hint: "It's breathing... maybe it's conscious?" },
        { id: "d", label: "D", text: "Burn the vines with a torch", hint: "Destroy them all" },
        { id: "e", label: "E", text: "Study their growth patterns", hint: "Maybe you can find a way to control them" },
      ],
    },
    broadcast: {
      narration: "The broadcast system crackles to life. Your voice echoes through empty channels. After an agonizing thirty seconds of silence, a sound comes through your headset — not human language, but a deep, rhythmic pulse. It's responding to you.",
      chapter: "Chapter 3: Signal", mood: "wonder",
      choices: [
        { id: "a", label: "A", text: "Mimic its rhythm", hint: "Maybe this is a language" },
        { id: "b", label: "B", text: "Cut the broadcast and run", hint: "You don't know what's on the other end" },
        { id: "c", label: "C", text: "Send Earth's coordinates", hint: "Whatever it is, let it know where we are" },
        { id: "d", label: "D", text: "Record the pulse signal", hint: "Bring it back for analysis" },
        { id: "e", label: "E", text: "Reply with math formulas", hint: "Math is the universal language" },
      ],
    },
    survivor: {
      narration: "The figure lifts their head. Their eyes are hollow, lips cracked, but alive. Their uniform reads 'Dr. Chen — Chief Biologist.' In a raspy voice: 'You shouldn't be here. It's awake. It's been waiting — waiting for a new host.'",
      chapter: "Chapter 3: Survivor", mood: "dread",
      choices: [
        { id: "a", label: "A", text: "Ask what 'it' is", hint: "Maybe he knows the truth" },
        { id: "b", label: "B", text: "Take him and leave", hint: "Evacuate first, questions later" },
        { id: "c", label: "C", text: "Check if he's infected", hint: "Something seems off about him..." },
        { id: "d", label: "D", text: "Give him water and food", hint: "He looks like he's about to collapse" },
        { id: "e", label: "E", text: "Ask about the other crew", hint: "Maybe others are still alive" },
      ],
    },
    observe: {
      narration: "You hold your breath, hiding behind the corner. The figure suddenly stops tapping and slowly turns their head. Half their face is covered in a silvery, metallic substance. It breathes, like a living mask. They smile — or at least, it looks like a smile.",
      chapter: "Chapter 3: Symbiont", mood: "horror",
      choices: [
        { id: "a", label: "A", text: "Turn and run", hint: "That's not human anymore" },
        { id: "b", label: "B", text: "Try to talk", hint: "They... it seems non-hostile" },
        { id: "c", label: "C", text: "Look for a weapon", hint: "Just in case" },
        { id: "d", label: "D", text: "Shine a light on it", hint: "See how it reacts to light" },
        { id: "e", label: "E", text: "Take a photo as evidence", hint: "Whatever happens, leave a record" },
      ],
    },
    flee: {
      narration: "You turn and run. Behind you, a soft, almost gentle sigh. The corridor lights begin dying one by one — not burning out, but being obscured by something. That sweet smell fills the air.",
      chapter: "Chapter 3: Darkness", mood: "dread",
      choices: [
        { id: "a", label: "A", text: "Keep running to the escape pod", hint: "Just get out of here" },
        { id: "b", label: "B", text: "Hide in the nearest cabin", hint: "Maybe it will pass" },
        { id: "c", label: "C", text: "Stop and face it", hint: "Running doesn't seem to work" },
        { id: "d", label: "D", text: "Make noise to lure it elsewhere", hint: "Create a diversion" },
        { id: "e", label: "E", text: "Activate corridor emergency lights", hint: "Maybe light can repel it" },
      ],
    },
    signal: {
      narration: "You touch two exposed wires together. Sparks fly and the bracelet emits a sharp electronic whistle — then every light in the station flickers. From somewhere deep within, a low groan, like a massive metal structure moaning. Your signal was heard... but not just by who you hoped.",
      chapter: "Chapter 3: Awakening", mood: "tension",
      choices: [
        { id: "a", label: "A", text: "Follow the sound", hint: "Need to know what happened" },
        { id: "b", label: "B", text: "Head to the escape pod", hint: "Time is running out" },
        { id: "c", label: "C", text: "Send the signal again", hint: "Maybe you can reach the outside" },
        { id: "d", label: "D", text: "Shut down all power systems", hint: "Let everything go silent again" },
        { id: "e", label: "E", text: "Use the bracelet to track the source", hint: "Find where it's coming from" },
      ],
    },
    frost: {
      narration: "You touch the frost. It's not cold — in fact, it's warm. At your touch, the crystals begin to slowly move, like living snowflakes. They creep up your fingertip, leaving a trail of faint blue luminescence on your skin. No pain, just a strange sense of peace.",
      chapter: "Chapter 3: Contact", mood: "wonder",
      choices: [
        { id: "a", label: "A", text: "Let it spread", hint: "Maybe this is how 'it' communicates" },
        { id: "b", label: "B", text: "Shake it off and back away", hint: "Don't know what this thing does" },
        { id: "c", label: "C", text: "Speak to it", hint: "If it's conscious, maybe it understands" },
        { id: "d", label: "D", text: "Close your eyes and feel it", hint: "Let go of fear and sense it" },
        { id: "e", label: "E", text: "Guide it onto the bracelet", hint: "Maybe it can repair the device" },
      ],
    },
    battery: {
      narration: "You carefully extract the micro-battery. It's hotter than expected. The moment you pull it free, somewhere in the station — a deep 'thud.' Like a heartbeat. Then another. And another. The entire station seems to be waking up.",
      chapter: "Chapter 3: Heartbeat", mood: "dread",
      choices: [
        { id: "a", label: "A", text: "Put the battery back", hint: "Maybe removing it triggered something" },
        { id: "b", label: "B", text: "Take the battery to the control room", hint: "Maybe you can use it to power something" },
        { id: "c", label: "C", text: "Drop it and run", hint: "Something is very wrong" },
        { id: "d", label: "D", text: "Follow the heartbeat to its source", hint: "It's coming from deep within" },
        { id: "e", label: "E", text: "Power the comm system with it", hint: "Last chance for a distress signal" },
      ],
    },
  }, [storyLang]);

  const currentScene = sceneGraph[currentSceneId];

  // Randomly pick 3 choices from 5 and relabel them A/B/C
  const [activeChoices, setActiveChoices] = useState<ChoiceItem[]>(() => {
    const picked = pickRandom(currentScene.choices, 3);
    return picked.map((c, i) => ({ ...c, label: ["A", "B", "C"][i], id: ["a", "b", "c"][i] }));
  });

  const [narrationText, setNarrationText] = useState(currentScene.narration);
  const [isTyping, setIsTyping] = useState(true);
  const [showChoices, setShowChoices] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [storyLog, setStoryLog] = useState<StoryEntry[]>([{ chapter: currentScene.chapter, narration: currentScene.narration }]);
  const [chapterTitle, setChapterTitle] = useState(currentScene.chapter);
  const [volumes, setVolumes] = useState({ master: 1, narration: 1, sfx: 0.7, music: 0.4 });

  const audioLayers = useMemo(() => [
    { type: "sfx", name: storyLang === "zh" ? "雨声" : "Rain", active: true },
    { type: "music", name: storyLang === "zh" ? "氛围音乐" : "Ambient", active: true },
    { type: "tts", name: t("player.narrating", lang), active: true },
  ], [storyLang, lang]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTyping(false);
      setTimeout(() => setShowChoices(true), 1000);
    }, narrationText.length * 50 + 500);
    return () => clearTimeout(timer);
  }, [narrationText]);

  const handleChoice = useCallback((choiceId: string, text?: string) => {
    setShowChoices(false);

    const chosenOption = activeChoices.find(c => c.id === choiceId);
    const choiceText = text || chosenOption?.text || choiceId;

    setStoryLog(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], choiceText };
      return updated;
    });

    const nextId = chosenOption?.next;
    if (!nextId || !sceneGraph[nextId]) {
      setShowEndScreen(true);
      return;
    }

    const nextScene = sceneGraph[nextId];
    setCurrentSceneId(nextId);
    setIsTyping(true);
    setMood(nextScene.mood);
    setNarrationText(nextScene.narration);
    setChapterTitle(nextScene.chapter);
    setStoryLog(prev => [...prev, { chapter: nextScene.chapter, narration: nextScene.narration }]);

    // Pick new random choices for the next scene
    const picked = pickRandom(nextScene.choices, 3);
    setActiveChoices(picked.map((c, i) => ({ ...c, label: ["A", "B", "C"][i], id: ["a", "b", "c"][i] })));
  }, [activeChoices, sceneGraph, pickRandom]);
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
    <div className="min-h-screen flex flex-col">
      <AtmosphericBackground />

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
          <div className="relative group/world">
            <Button variant="ghost" size="sm" className="text-muted-foreground"><Edit3 size={14} /><span className="ml-1 text-xs hidden md:inline">{t("player.world", lang)}</span></Button>
            <div className="absolute top-full right-0 mt-2 z-50 bg-background border border-border rounded-xl shadow-lg p-4 w-64 space-y-3 hidden group-hover/world:block">
              <h3 className="text-xs font-mono uppercase text-muted-foreground tracking-wider">{t("player.world", lang)}</h3>
              <div className="space-y-2 text-sm text-foreground/80">
                <p><span className="text-muted-foreground">{storyLang === "zh" ? "地点：" : "Location: "}</span>{storyLang === "zh" ? "废弃空间站 · 第7区" : "Abandoned Station · Sector 7"}</p>
                <p><span className="text-muted-foreground">{storyLang === "zh" ? "时间：" : "Time: "}</span>{storyLang === "zh" ? "未知（系统时钟损坏）" : "Unknown (system clock damaged)"}</p>
                <p><span className="text-muted-foreground">{storyLang === "zh" ? "氛围：" : "Mood: "}</span>{storyLang === "zh" ? "紧张 · 神秘" : "Tense · Mysterious"}</p>
              </div>
            </div>
          </div>
          <div className="relative group/voice">
            <Button variant="ghost" size="sm" className="text-muted-foreground"><Mic size={14} /><span className="ml-1 text-xs hidden md:inline">{t("player.voice", lang)}</span></Button>
            <div className="absolute top-full right-0 mt-2 z-50 bg-background border border-border rounded-xl shadow-lg p-4 w-64 space-y-3 hidden group-hover/voice:block">
              <h3 className="text-xs font-mono uppercase text-muted-foreground tracking-wider">{t("player.voice", lang)}</h3>
              <div className="space-y-2 text-sm text-foreground/80">
                <p><span className="text-muted-foreground">{storyLang === "zh" ? "当前声音：" : "Current voice: "}</span>{storyLang === "zh" ? "默认旁白" : "Default Narrator"}</p>
                <p><span className="text-muted-foreground">{storyLang === "zh" ? "语速：" : "Speed: "}</span>1.0x</p>
                <p><span className="text-muted-foreground">{storyLang === "zh" ? "稳定性：" : "Stability: "}</span>0.5</p>
              </div>
            </div>
          </div>
          <div className="relative group/volume">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Volume2 size={14} /><span className="ml-1 text-xs hidden md:inline">{t("player.volume", lang)}</span>
            </Button>
            <div className="absolute top-full right-0 mt-2 z-50 hidden group-hover/volume:block">
              <VolumeControl volumes={volumes} onChange={handleVolumeChange} />
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleEndStory} className="text-destructive/70 hover:text-destructive">
            <Square size={14} /><span className="ml-1 text-xs hidden md:inline">{t("player.end", lang)}</span>
          </Button>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="relative z-20 flex-1 flex flex-col justify-start">
        <div className="pt-2 pb-0">
          <NarrationDisplay text={narrationText} isTyping={isTyping} />
        </div>
      </div>

      <div className="relative z-20">
        <AudioLayerIndicator layers={audioLayers} />
      </div>

      <div className="relative z-20 pb-6 pt-4">
        <AnimatePresence>
          {showChoices && (
            <ChoicePanel
              choices={currentScene.choices}
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
            decisions: storyLog.filter(e => e.choiceText).length,
            audioLayers: storyLang === "zh" ? "32 音效 + 6 配乐 + 10 旁白" : "32 SFX + 6 Music + 10 Narration",
            cacheHit: "42% (13/31)",
          }}
          storyLog={storyLog}
          onAction={handleEndAction}
        />
      )}
    </div>
  );
};

export default PlayerPage;
