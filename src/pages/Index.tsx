import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSettingsStore } from "@/lib/store/settings-store";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import HomePage from "@/pages/HomePage";
import { Button } from "@/components/ui/button";
import { Settings, Plus, Clock } from "lucide-react";

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide nav on player page
  if (location.pathname.startsWith("/play/")) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-background/60 backdrop-blur-xl border-b border-border/30">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate("/")} className="text-xl font-bold font-serif text-gradient-primary">
          Echoverse
        </button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate("/create")}>
            <Plus size={16} className="mr-1" /> Create
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
            <Clock size={16} className="mr-1" /> History
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
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
