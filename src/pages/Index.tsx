import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSettingsStore } from "@/lib/store/settings-store";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import HomePage from "@/pages/HomePage";
import EchoverseLogo from "@/components/EchoverseLogo";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Settings, Plus, Clock } from "lucide-react";

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);

  if (location.pathname.startsWith("/play/")) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-background/60 backdrop-blur-xl border-b border-border/30">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 group">
          <EchoverseLogo size={36} />
          <span className="text-xl font-bold font-serif text-accent">Echoverse</span>
        </button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate("/create")} className="text-muted-foreground hover:text-foreground">
            <Plus size={16} className="mr-1" /> {t("nav.create", lang)}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/history")} className="text-muted-foreground hover:text-foreground">
            <Clock size={16} className="mr-1" /> {t("nav.history", lang)}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground">
            <Settings size={16} />
          </Button>
        </div>
      </div>
    </nav>
  );
};

const Index = () => {
  const { onboardingCompleted } = useSettingsStore();
  const [showOnboarding, setShowOnboarding] = useState(!onboardingCompleted);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!onboardingCompleted && location.pathname !== "/") {
      setShowOnboarding(true);
    }
  }, [onboardingCompleted, location.pathname]);

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={() => {
          setShowOnboarding(false);
          navigate("/create");
        }}
      />
    );
  }

  return (
    <>
      <Navigation />
      <div className="pt-14">
        <HomePage />
      </div>
    </>
  );
};

export default Index;
