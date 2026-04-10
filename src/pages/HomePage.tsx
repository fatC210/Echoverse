import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Button } from "@/components/ui/button";
import { Headphones, Sparkles, Brain, Music, ArrowRight } from "lucide-react";

const FloatingParticle = ({ delay, x, size }: { delay: number; x: number; size: number }) => (
  <div
    className="absolute rounded-full bg-accent/20 animate-float-up"
    style={{
      left: `${x}%`,
      width: `${size}px`,
      height: `${size}px`,
      animationDelay: `${delay}s`,
      animationDuration: `${12 + Math.random() * 8}s`,
    }}
  />
);

const HeroSection = () => {
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);
  const navigate = useNavigate();

  const particles = Array.from({ length: 15 }, (_, i) => ({
    delay: i * 1.5,
    x: Math.random() * 100,
    size: 2 + Math.random() * 3,
  }));

  return (
    <section className="relative min-h-[85vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-background" />
        {/* Central glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]">
          <div className="absolute inset-0 rounded-full bg-accent/[0.04] animate-glow-pulse" />
        </div>
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--accent)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--accent)) 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
          }}
        />
        {/* Particles */}
        <div className="particle-field">
          {particles.map((p, i) => <FloatingParticle key={i} {...p} />)}
        </div>
      </div>

      <motion.div
        className="relative z-10 max-w-3xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-sm text-accent mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Headphones size={14} />
          <span>{lang === "zh" ? "互动式 AI 音频叙事引擎" : "Interactive AI Audio Narrative Engine"}</span>
        </motion.div>

        <motion.h1
          className="text-6xl md:text-8xl font-bold font-serif mb-6 text-accent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Echoverse
        </motion.h1>

        <motion.p
          className="text-xl md:text-2xl text-muted-foreground font-serif mb-12 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {t("app.tagline", lang)}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
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
          className="mt-10 text-sm text-muted-foreground/60 font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
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
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <motion.div
            key={f.titleKey}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.15 }}
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

const HomePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <FeatureCards />
    </div>
  );
};

export default HomePage;
