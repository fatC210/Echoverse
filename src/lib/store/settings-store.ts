import { create } from "zustand";
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MODEL,
  DEFAULT_SETTINGS,
  type EchoSettings,
} from "../constants/defaults";
import {
  hasRequiredConfiguration as hasRequiredConfigurationValue,
  hasValidatedServiceConfiguration,
  serializeLlmVerification,
  serializeTurbopufferVerification,
} from "../utils/settings-validation";

const STORAGE_KEY = "echoverse_settings";

function readStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function normalizePreferences(
  preferences?: Partial<EchoSettings["preferences"]> | null,
): EchoSettings["preferences"] {
  return {
    interfaceLang: preferences?.interfaceLang === "zh" ? "zh" : "en",
    storyLang: preferences?.storyLang === "zh" ? "zh" : "en",
  };
}

function loadSettings(): EchoSettings {
  try {
    const storage = readStorage();
    const raw = storage?.getItem(STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw) as Partial<EchoSettings>;
      const nextLlm = {
        ...DEFAULT_SETTINGS.llm,
        ...parsed.llm,
      };

      // Migrate previously persisted default values to placeholders.
      if (nextLlm.baseUrl.trim() === DEFAULT_LLM_BASE_URL) {
        nextLlm.baseUrl = "";
      }

      if (nextLlm.model.trim() === DEFAULT_LLM_MODEL) {
        nextLlm.model = "";
      }

      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        llm: nextLlm,
        elevenlabs: {
          ...DEFAULT_SETTINGS.elevenlabs,
          ...parsed.elevenlabs,
        },
        turbopuffer: {
          ...DEFAULT_SETTINGS.turbopuffer,
          ...parsed.turbopuffer,
        },
        voice: {
          ...DEFAULT_SETTINGS.voice,
          ...parsed.voice,
        },
        preferences: normalizePreferences(parsed.preferences),
        customTags: Array.isArray(parsed.customTags)
          ? parsed.customTags
          : DEFAULT_SETTINGS.customTags,
        onboardingCompleted:
          parsed.onboardingCompleted ?? DEFAULT_SETTINGS.onboardingCompleted,
      };
    }
  } catch {
    // Ignore invalid local data and fall back to defaults.
  }

  return {
    ...DEFAULT_SETTINGS,
  };
}

function selectSettings(state: SettingsStore): EchoSettings {
  return {
    llm: state.llm,
    elevenlabs: state.elevenlabs,
    turbopuffer: state.turbopuffer,
    voice: state.voice,
    preferences: state.preferences,
    customTags: state.customTags,
    onboardingCompleted: state.onboardingCompleted,
  };
}

function saveSettings(settings: EchoSettings) {
  try {
    readStorage()?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage write failures.
  }
}

interface SettingsStore extends EchoSettings {
  isHydrated: boolean;
  hydrate: () => void;
  hasValidatedServiceConfiguration: () => boolean;
  hasRequiredConfiguration: () => boolean;
  updateLlm: (llm: Partial<EchoSettings["llm"]>) => void;
  updateElevenlabs: (el: Partial<EchoSettings["elevenlabs"]>) => void;
  updateTurbopuffer: (tp: Partial<EchoSettings["turbopuffer"]>) => void;
  updateVoice: (voice: Partial<EchoSettings["voice"]>) => void;
  updatePreferences: (prefs: Partial<EchoSettings["preferences"]>) => void;
  setCustomTags: (tags: string[]) => void;
  setOnboardingCompleted: (value: boolean) => void;
  clearAll: () => void;
  reload: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  isHydrated: false,
  hydrate: () => {
    set({
      ...loadSettings(),
      isHydrated: true,
    });
  },
  hasValidatedServiceConfiguration: () => {
    const state = get();

    return hasValidatedServiceConfiguration({
      llm: state.llm,
      elevenlabs: state.elevenlabs,
      turbopuffer: state.turbopuffer,
    });
  },
  hasRequiredConfiguration: () => {
    const state = get();

    return hasRequiredConfigurationValue({
      llm: state.llm,
      elevenlabs: state.elevenlabs,
      turbopuffer: state.turbopuffer,
      voice: state.voice,
    });
  },
  updateLlm: (llm) => {
    const currentLlm = get().llm;
    const nextLlm = {
      ...currentLlm,
      ...llm,
    };

    const nextVerifiedSignature =
      typeof llm.verifiedConfigSignature === "string"
        ? llm.verifiedConfigSignature.trim()
        : (nextLlm.verifiedConfigSignature ?? "").trim();

    if (
      !nextLlm.apiKey.trim() ||
      nextVerifiedSignature !== serializeLlmVerification(nextLlm)
    ) {
      nextLlm.verifiedConfigSignature = "";
    }

    const next = {
      ...selectSettings(get()),
      llm: nextLlm,
    };
    saveSettings(next);
    set({ llm: next.llm });
  },
  updateElevenlabs: (el) => {
    const currentElevenlabs = get().elevenlabs;
    const nextElevenlabs = {
      ...currentElevenlabs,
      ...el,
    };

    if (typeof el.apiKey === "string") {
      const nextApiKey = el.apiKey.trim();
      const nextVerifiedApiKey =
        typeof el.verifiedApiKey === "string"
          ? el.verifiedApiKey.trim()
          : (nextElevenlabs.verifiedApiKey ?? "").trim();

      if (!nextApiKey || nextVerifiedApiKey !== nextApiKey) {
        nextElevenlabs.verifiedApiKey = "";
      }
    }

    const next = {
      ...selectSettings(get()),
      elevenlabs: nextElevenlabs,
    };
    saveSettings(next);
    set({ elevenlabs: next.elevenlabs });
  },
  updateTurbopuffer: (tp) => {
    const currentTurbopuffer = get().turbopuffer;
    const nextTurbopuffer = {
      ...currentTurbopuffer,
      ...tp,
    };

    const nextVerifiedSignature =
      typeof tp.verifiedConfigSignature === "string"
        ? tp.verifiedConfigSignature.trim()
        : (nextTurbopuffer.verifiedConfigSignature ?? "").trim();

    if (
      !nextTurbopuffer.apiKey.trim() ||
      nextVerifiedSignature !== serializeTurbopufferVerification(nextTurbopuffer)
    ) {
      nextTurbopuffer.verifiedConfigSignature = "";
    }

    const next = {
      ...selectSettings(get()),
      turbopuffer: nextTurbopuffer,
    };
    saveSettings(next);
    set({ turbopuffer: next.turbopuffer });
  },
  updateVoice: (voice) => {
    const next = {
      ...selectSettings(get()),
      voice: { ...get().voice, ...voice },
    };
    saveSettings(next);
    set({ voice: next.voice });
  },
  updatePreferences: (prefs) => {
    const next = {
      ...selectSettings(get()),
      preferences: { ...get().preferences, ...prefs },
    };
    saveSettings(next);
    set({ preferences: next.preferences });
  },
  setCustomTags: (tags) => {
    const next = {
      ...selectSettings(get()),
      customTags: tags,
    };
    saveSettings(next);
    set({ customTags: tags });
  },
  setOnboardingCompleted: (value) => {
    const next = {
      ...selectSettings(get()),
      onboardingCompleted: value,
    };
    saveSettings(next);
    set({ onboardingCompleted: value });
  },
  clearAll: () => {
    readStorage()?.removeItem(STORAGE_KEY);
    set({
      ...DEFAULT_SETTINGS,
      isHydrated: true,
    });
  },
  reload: () => {
    set({
      ...loadSettings(),
      isHydrated: true,
    });
  },
}));
