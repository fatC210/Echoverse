"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { listStories } from "@/lib/db";
import type { Story } from "@/lib/types/echoverse";
import { formatDuration } from "@/lib/utils/echoverse";
import { Button } from "@/components/ui/button";
import { Sparkles, Brain, Music, ArrowRight } from "lucide-react";

type FloatingParticleConfig = {
  delay: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  driftX: number;
  driftY: number;
  peakOpacity: number;
};

type GlowOrbConfig = {
  delay: number;
  x: number;
  y: number;
  size: number;
  driftX: number;
  driftY: number;
  duration: number;
};

type ShootingStarConfig = {
  delay: number;
  startX: number;
  startY: number;
  repeatDelay: number;
};

type PulsingDotConfig = {
  x: number;
  y: number;
  delay: number;
  size: number;
  duration: number;
};

const seededValue = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const formatPercent = (value: number) => `${value.toFixed(4)}%`;

const formatPixels = (value: number) => `${value.toFixed(4)}px`;

const getEdgePosition = (seed: number) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const x = seededValue(seed + attempt * 2 + 1) * 100;
    const y = seededValue(seed + attempt * 2 + 2) * 100;

    if (!(x > 25 && x < 75 && y > 20 && y < 80)) {
      return { x, y };
    }
  }

  return {
    x: seededValue(seed + 101) < 0.5 ? 12 : 88,
    y: seededValue(seed + 102) * 100,
  };
};

const particles: FloatingParticleConfig[] = Array.from({ length: 60 }, (_, i) => {
  const seed = 1000 + i * 17;
  const { x, y } = getEdgePosition(seed);

  return {
    delay: i * 0.4 + seededValue(seed + 1) * 2,
    x,
    y,
    size: 1 + seededValue(seed + 2) * 3.5,
    duration: 5 + seededValue(seed + 3) * 10,
    driftX: (seededValue(seed + 4) - 0.5) * 50,
    driftY: -(20 + seededValue(seed + 5) * 40),
    peakOpacity: 0.5 + seededValue(seed + 6) * 0.3,
  };
});

const glowOrbs: GlowOrbConfig[] = Array.from({ length: 6 }, (_, i) => {
  const seed = 2000 + i * 23;
  const { x, y } = getEdgePosition(seed);

  return {
    delay: i * 2,
    x,
    y,
    size: 40 + seededValue(seed + 1) * 60,
    driftX: (seededValue(seed + 2) - 0.5) * 80,
    driftY: (seededValue(seed + 3) - 0.5) * 80,
    duration: 12 + seededValue(seed + 4) * 8,
  };
});

const shootingStars: ShootingStarConfig[] = Array.from({ length: 4 }, (_, i) => {
  const seed = 3000 + i * 29;

  return {
    delay: i * 5 + seededValue(seed + 1) * 3,
    startX: seededValue(seed + 2) * 20,
    startY: seededValue(seed + 3) * 30,
    repeatDelay: 8 + seededValue(seed + 4) * 12,
  };
});

const pulsingDots: PulsingDotConfig[] = Array.from({ length: 15 }, (_, i) => {
  const seed = 4000 + i * 19;
  const { x, y } = getEdgePosition(seed);

  return {
    x,
    y,
    delay: i * 0.8 + seededValue(seed + 1) * 2,
    size: 2 + seededValue(seed + 2) * 3,
    duration: 3 + seededValue(seed + 3) * 3,
  };
});

/* Standard small particle */
const FloatingParticle = ({ delay, x, y, size, duration, driftX, driftY, peakOpacity }: FloatingParticleConfig) => (
  <motion.div
    className="absolute rounded-full bg-accent"
    style={{ left: formatPercent(x), top: formatPercent(y), width: formatPixels(size), height: formatPixels(size) }}
    animate={{
      y: [0, driftY, 0],
      x: [0, driftX, 0],
      opacity: [0, peakOpacity, 0],
      scale: [0.5, 1, 0.5],
    }}
    transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
  />
);

/* Glowing orb - larger, blurred, slow-moving */
const GlowOrb = ({ delay, x, y, size, driftX, driftY, duration }: GlowOrbConfig) => (
  <motion.div
    className="absolute rounded-full bg-accent/20"
    style={{
      left: formatPercent(x), top: formatPercent(y), width: formatPixels(size), height: formatPixels(size),
      filter: `blur(${formatPixels(size / 3)})`,
      boxShadow: `0 0 ${formatPixels(size)} ${formatPixels(size / 3)} hsl(var(--accent) / 0.15)`,
    }}
    animate={{
      x: [0, driftX, 0],
      y: [0, driftY, 0],
      opacity: [0.1, 0.35, 0.1],
      scale: [0.8, 1.2, 0.8],
    }}
    transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
  />
);

/* Shooting star - fast diagonal streak */
const ShootingStar = ({ delay, startX, startY, repeatDelay }: ShootingStarConfig) => (
  <motion.div
    className="absolute"
    style={{ left: formatPercent(startX), top: formatPercent(startY) }}
    initial={{ opacity: 0 }}
    animate={{
      x: [0, 200],
      y: [0, 120],
      opacity: [0, 0.8, 0],
    }}
    transition={{ duration: 1.5, delay, repeat: Infinity, repeatDelay, ease: "easeIn" }}
  >
    <div
      className="bg-accent rounded-full"
      style={{
        width: 3, height: 3,
        boxShadow: `
          -4px 0 6px 1px hsl(var(--accent) / 0.4),
          -10px 0 12px 2px hsl(var(--accent) / 0.2),
          -20px 0 20px 3px hsl(var(--accent) / 0.1)
        `,
      }}
    />
  </motion.div>
);

/* Pulsing dot - stays in place, breathes */
const PulsingDot = ({ x, y, delay, size, duration }: PulsingDotConfig) => (
  <motion.div
    className="absolute rounded-full bg-accent"
    style={{ left: formatPercent(x), top: formatPercent(y), width: formatPixels(size), height: formatPixels(size) }}
    animate={{
      opacity: [0.1, 0.6, 0.1],
      scale: [1, 1.8, 1],
      boxShadow: [
        `0 0 0px 0px hsl(var(--accent) / 0)`,
        `0 0 ${formatPixels(size * 4)} ${formatPixels(size * 2)} hsl(var(--accent) / 0.15)`,
        `0 0 0px 0px hsl(var(--accent) / 0)`,
      ],
    }}
    transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
  />
);

const HeroSection = () => {
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);
  const hasRequiredConfiguration = useSettingsStore((s) => s.hasRequiredConfiguration());
  const router = useRouter();

  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-background" />

        {/* Central glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]">
          <motion.div
            className="absolute inset-0 rounded-full bg-accent/[0.06]"
            animate={{ scale: [1, 1.15, 1], opacity: [0.04, 0.09, 0.04] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            style={{ filter: 'blur(60px)' }}
          />
        </div>

        {/* Glow orbs */}
        {glowOrbs.map((o, i) => <GlowOrb key={`orb-${i}`} {...o} />)}

        {/* Floating particles */}
        {particles.map((p, i) => <FloatingParticle key={`p-${i}`} {...p} />)}

        {/* Pulsing dots */}
        {pulsingDots.map((d, i) => <PulsingDot key={`dot-${i}`} {...d} />)}

        {/* Shooting stars */}
        {shootingStars.map((s, i) => <ShootingStar key={`star-${i}`} {...s} />)}

        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--accent)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--accent)) 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      <motion.div
        className="relative z-10 max-w-3xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-sm text-accent mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span>{lang === "zh" ? "互动式 AI 音频叙事引擎" : "Interactive AI Audio Narrative Engine"}</span>
        </motion.div>

        <motion.h1
          className="text-6xl md:text-8xl font-bold font-serif mb-6 text-accent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{ textShadow: '0 0 60px hsl(var(--accent) / 0.2)' }}
        >
          Echoverse
        </motion.h1>

        <motion.p
          className="text-xl md:text-2xl text-muted-foreground font-serif mb-12 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {t("app.tagline", lang)}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="space-y-6"
        >
          <Button
            onClick={() => router.push(hasRequiredConfiguration ? "/create" : "/settings")}
            size="lg"
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-10 py-7 text-lg btn-game glow-accent-strong"
          >
            {hasRequiredConfiguration
              ? t("home.hero.cta.new", lang)
              : t("home.hero.cta.setup", lang)}
            <ArrowRight className="ml-2" size={20} />
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
};

const features = [
  { Icon: Sparkles, titleKey: "home.features.interactive.title", descKey: "home.features.interactive.desc" },
  { Icon: Music, titleKey: "home.features.audio.title", descKey: "home.features.audio.desc" },
  { Icon: Brain, titleKey: "home.features.adaptive.title", descKey: "home.features.adaptive.desc" },
];

const FeatureCards = () => {
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);

  return (
    <section className="py-20 px-4 relative">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <motion.div
            key={f.titleKey}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="glass-panel-strong p-6 text-center group hover:border-accent/30 transition-all duration-300"
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-accent/10 border border-accent/15 flex items-center justify-center group-hover:glow-accent transition-all duration-300">
              <f.Icon size={24} className="text-accent" />
            </div>
            <h3 className="text-lg font-semibold font-serif mb-2 group-hover:text-accent transition-colors">
              {t(f.titleKey, lang)}
            </h3>
            <p className="text-sm text-muted-foreground">{t(f.descKey, lang)}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

const RecentStories = () => {
  const router = useRouter();
  const lang = useSettingsStore((state) => state.preferences.interfaceLang);
  const [stories, setStories] = useState<Story[]>([]);

  useEffect(() => {
    void listStories().then((items) => setStories(items.slice(0, 3)));
  }, []);

  if (!stories.length) {
    return null;
  }

  return (
    <section className="relative px-4 pb-20">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-accent">{lang === "zh" ? "最近故事" : "Recent Stories"}</h2>
          <Button variant="ghost" size="sm" onClick={() => router.push("/history")} className="text-muted-foreground hover:text-foreground">
            {t("nav.history", lang)}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {stories.map((story) => (
            <button
              key={story.id}
              onClick={() => router.push(story.status === "completed" ? `/play/${story.id}?view=summary` : `/play/${story.id}`)}
              className="glass-panel hover-card text-left p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg text-foreground">{story.title}</h3>
                  <p className="text-xs text-muted-foreground">{story.genre}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${story.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : "bg-accent/20 text-accent"}`}>
                  {story.status === "completed" ? t("history.status.completed", lang) : t("history.status.playing", lang)}
                </span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{story.premise}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDuration(story.totalDurationSec)}</span>
                <span>{story.totalDecisions} {t("history.decisions", lang)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

const HomePage = () => (
  <div className="app-shell-page bg-background">
    <HeroSection />
    <FeatureCards />
    <RecentStories />
  </div>
);

export default HomePage;
