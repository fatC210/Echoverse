import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Button } from "@/components/ui/button";
import { Headphones, Sparkles, Brain, Music, ArrowRight } from "lucide-react";

const HeroSection = () => {
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
      {/* Ambient bg */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute top-20 left-1/3 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-20 right-1/3 w-[400px] h-[400px] bg-accent/8 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: "4s" }} />
      </div>

      <motion.div
        className="relative z-10 max-w-3xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Headphones size={14} />
          <span>Interactive Audio Narrative Engine</span>
        </motion.div>

        <h1 className="text-6xl md:text-7xl font-bold font-serif mb-6 text-gradient-primary">
          Echoverse
        </h1>

        <p className="text-xl md:text-2xl text-muted-foreground font-serif mb-10 leading-relaxed">
          {t("app.tagline", lang)}
        </p>

        <Button
          onClick={() => navigate("/create")}
          size="lg"
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground px-8 py-6 text-lg glow-primary"
        >
          {t("home.hero.cta.new", lang)}
          <ArrowRight className="ml-2" size={20} />
        </Button>

        <p className="mt-8 text-sm text-muted-foreground">
          {t("home.quickstart", lang)}
        </p>
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
            className="glass-panel p-6 text-center hover:border-primary/30 transition-colors group"
          >
            <div className="text-4xl mb-4">{f.emoji}</div>
            <h3 className="text-lg font-semibold font-serif mb-2 group-hover:text-gradient-primary transition-colors">
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
