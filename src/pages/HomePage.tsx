import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Button } from "@/components/ui/button";
import { Sparkles, Brain, Music, ArrowRight } from "lucide-react";

/* Standard small particle */
const FloatingParticle = ({ delay, x, y, size, duration }: { delay: number; x: number; y: number; size: number; duration: number }) => (
  <motion.div
    className="absolute rounded-full bg-accent"
    style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
    animate={{
      y: [0, -(20 + Math.random() * 40), 0],
      x: [0, (Math.random() - 0.5) * 50, 0],
      opacity: [0, 0.5 + Math.random() * 0.3, 0],
      scale: [0.5, 1, 0.5],
    }}
    transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
  />
);

/* Glowing orb - larger, blurred, slow-moving */
const GlowOrb = ({ delay, x, y, size }: { delay: number; x: number; y: number; size: number }) => (
  <motion.div
    className="absolute rounded-full bg-accent/20"
    style={{
      left: `${x}%`, top: `${y}%`, width: size, height: size,
      filter: `blur(${size / 3}px)`,
      boxShadow: `0 0 ${size}px ${size / 3}px hsl(var(--accent) / 0.15)`,
    }}
    animate={{
      x: [0, (Math.random() - 0.5) * 80, 0],
      y: [0, (Math.random() - 0.5) * 80, 0],
      opacity: [0.1, 0.35, 0.1],
      scale: [0.8, 1.2, 0.8],
    }}
    transition={{ duration: 12 + Math.random() * 8, delay, repeat: Infinity, ease: "easeInOut" }}
  />
);

/* Shooting star - fast diagonal streak */
const ShootingStar = ({ delay, startX, startY }: { delay: number; startX: number; startY: number }) => (
  <motion.div
    className="absolute"
    style={{ left: `${startX}%`, top: `${startY}%` }}
    initial={{ opacity: 0 }}
    animate={{
      x: [0, 200],
      y: [0, 120],
      opacity: [0, 0.8, 0],
    }}
    transition={{ duration: 1.5, delay, repeat: Infinity, repeatDelay: 8 + Math.random() * 12, ease: "easeIn" }}
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
const PulsingDot = ({ x, y, delay, size }: { x: number; y: number; delay: number; size: number }) => (
  <motion.div
    className="absolute rounded-full bg-accent"
    style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
    animate={{
      opacity: [0.1, 0.6, 0.1],
      scale: [1, 1.8, 1],
      boxShadow: [
        `0 0 0px 0px hsl(var(--accent) / 0)`,
        `0 0 ${size * 4}px ${size * 2}px hsl(var(--accent) / 0.15)`,
        `0 0 0px 0px hsl(var(--accent) / 0)`,
      ],
    }}
    transition={{ duration: 3 + Math.random() * 3, delay, repeat: Infinity, ease: "easeInOut" }}
  />
);

const HeroSection = () => {
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);
  const navigate = useNavigate();

  // Helper: generate position avoiding center content zone (30-70% x, 25-75% y)
  const edgePos = () => {
    let x: number, y: number;
    do {
      x = Math.random() * 100;
      y = Math.random() * 100;
    } while (x > 25 && x < 75 && y > 20 && y < 80);
    return { x, y };
  };

  const particles = Array.from({ length: 60 }, (_, i) => {
    const { x, y } = edgePos();
    return { delay: i * 0.4 + Math.random() * 2, x, y, size: 1 + Math.random() * 3.5, duration: 5 + Math.random() * 10 };
  });

  const glowOrbs = Array.from({ length: 6 }, (_, i) => {
    const { x, y } = edgePos();
    return { delay: i * 2, x, y, size: 40 + Math.random() * 60 };
  });

  const shootingStars = Array.from({ length: 4 }, (_, i) => ({
    delay: i * 5 + Math.random() * 3,
    startX: Math.random() * 20,
    startY: Math.random() * 30,
  }));

  const pulsingDots = Array.from({ length: 15 }, (_, i) => {
    const { x, y } = edgePos();
    return { x, y, delay: i * 0.8 + Math.random() * 2, size: 2 + Math.random() * 3 };
  });

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
        >
          <Button
            onClick={() => navigate("/create")}
            size="lg"
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-10 py-7 text-lg btn-game glow-accent-strong"
          >
            {t("home.hero.cta.new", lang)}
            <ArrowRight className="ml-2" size={20} />
          </Button>
        </motion.div>

        <motion.p
          className="mt-10 text-sm text-muted-foreground/50 font-mono tracking-wider"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          {t("home.quickstart", lang)}
        </motion.p>
      </motion.div>
    </section>
  );
};

const features = [
  { icon: Sparkles, titleKey: "home.features.interactive.title", descKey: "home.features.interactive.desc", emoji: "🎭" },
  { icon: Music, titleKey: "home.features.audio.title", descKey: "home.features.audio.desc", emoji: "🎵" },
  { icon: Brain, titleKey: "home.features.adaptive.title", descKey: "home.features.adaptive.desc", emoji: "🧠" },
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
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-accent/10 border border-accent/15 flex items-center justify-center text-2xl group-hover:glow-accent transition-all duration-300">
              {f.emoji}
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

const HomePage = () => (
  <div className="min-h-screen bg-background">
    <HeroSection />
    <FeatureCards />
  </div>
);

export default HomePage;
