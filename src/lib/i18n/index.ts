import en from "./en.json";
import zh from "./zh.json";

const messages: Record<string, Record<string, string>> = { en, zh };

export function t(key: string, lang: "en" | "zh" = "en"): string {
  return messages[lang]?.[key] ?? messages.en[key] ?? key;
}

export function useI18n() {
  const settings = localStorage.getItem("echoverse_settings");
  const lang = settings
    ? (JSON.parse(settings).preferences?.interfaceLang ?? "en")
    : "en";
  return {
    t: (key: string) => t(key, lang),
    lang: lang as "en" | "zh",
  };
}
