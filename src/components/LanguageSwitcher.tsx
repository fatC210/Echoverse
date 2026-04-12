import { useSettingsStore } from "@/lib/store/settings-store";
import { Globe } from "lucide-react";

const LanguageSwitcher = () => {
  const { preferences, updatePreferences } = useSettingsStore();
  const next = preferences.interfaceLang === "en" ? "zh" : "en";

  return (
    <button
      onClick={() => updatePreferences({ interfaceLang: next })}
      className="hover-surface flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs text-muted-foreground"
      title={next === "zh" ? "切换到中文" : "Switch to English"}
    >
      <Globe size={14} />
      <span className="font-mono uppercase">{preferences.interfaceLang === "en" ? "EN" : "中"}</span>
    </button>
  );
};

export default LanguageSwitcher;
