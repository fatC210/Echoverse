import { create } from "zustand";
import { DEFAULT_SETTINGS, type EchoSettings } from "../constants/defaults";

const STORAGE_KEY = "echoverse_settings";

function loadSettings(): EchoSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: EchoSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface SettingsStore extends EchoSettings {
  updateLlm: (llm: Partial<EchoSettings["llm"]>) => void;
  updateElevenlabs: (el: Partial<EchoSettings["elevenlabs"]>) => void;
  updateTurbopuffer: (tp: Partial<EchoSettings["turbopuffer"]>) => void;
  updateVoice: (voice: Partial<EchoSettings["voice"]>) => void;
  updatePreferences: (prefs: Partial<EchoSettings["preferences"]>) => void;
  setCustomTags: (tags: string[]) => void;
  setOnboardingCompleted: (v: boolean) => void;
  clearAll: () => void;
  reload: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...loadSettings(),

  updateLlm: (llm) => {
    const next = { ...get(), llm: { ...get().llm, ...llm } };
    saveSettings(next);
    set({ llm: next.llm });
  },
  updateElevenlabs: (el) => {
    const next = { ...get(), elevenlabs: { ...get().elevenlabs, ...el } };
    saveSettings(next);
    set({ elevenlabs: next.elevenlabs });
  },
  updateTurbopuffer: (tp) => {
    const next = { ...get(), turbopuffer: { ...get().turbopuffer, ...tp } };
    saveSettings(next);
    set({ turbopuffer: next.turbopuffer });
  },
  updateVoice: (voice) => {
    const next = { ...get(), voice: { ...get().voice, ...voice } };
    saveSettings(next);
    set({ voice: next.voice });
  },
  updatePreferences: (prefs) => {
    const next = { ...get(), preferences: { ...get().preferences, ...prefs } };
    saveSettings(next);
    set({ preferences: next.preferences });
  },
  setCustomTags: (tags) => {
    const next = { ...get(), customTags: tags };
    saveSettings(next);
    set({ customTags: tags });
  },
  setOnboardingCompleted: (v) => {
    const next = { ...get(), onboardingCompleted: v };
    saveSettings(next);
    set({ onboardingCompleted: v });
  },
  clearAll: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ ...DEFAULT_SETTINGS });
  },
  reload: () => {
    set(loadSettings());
  },
}));
