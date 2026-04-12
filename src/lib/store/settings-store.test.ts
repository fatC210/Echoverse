import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/constants/defaults";
import {
  serializeLlmVerification,
  serializeTurbopufferVerification,
} from "@/lib/utils/settings-validation";
import { useSettingsStore } from "./settings-store";

describe("settings-store validation selectors", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      isHydrated: true,
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().clearAll();
  });

  it("separates validated services from the final start requirement", () => {
    const llm = {
      ...DEFAULT_SETTINGS.llm,
      apiKey: "sk-test",
    };
    const turbopuffer = {
      ...DEFAULT_SETTINGS.turbopuffer,
      apiKey: "tp-test",
    };

    useSettingsStore.getState().updateLlm({
      ...llm,
      verifiedConfigSignature: serializeLlmVerification(llm),
    });
    useSettingsStore.getState().updateElevenlabs({
      apiKey: "xi-test",
      verifiedApiKey: "xi-test",
    });
    useSettingsStore.getState().updateTurbopuffer({
      ...turbopuffer,
      verifiedConfigSignature: serializeTurbopufferVerification(turbopuffer),
    });

    expect(useSettingsStore.getState().hasValidatedServiceConfiguration()).toBe(
      true,
    );
    expect(useSettingsStore.getState().hasRequiredConfiguration()).toBe(false);

    useSettingsStore.getState().updateVoice({ voiceId: "voice-1" });

    expect(useSettingsStore.getState().hasRequiredConfiguration()).toBe(true);
  });

  it("clears persisted verification when LLM or turbopuffer inputs change", () => {
    const llm = {
      ...DEFAULT_SETTINGS.llm,
      apiKey: "sk-test",
    };
    const turbopuffer = {
      ...DEFAULT_SETTINGS.turbopuffer,
      apiKey: "tp-test",
    };

    useSettingsStore.getState().updateLlm({
      ...llm,
      verifiedConfigSignature: serializeLlmVerification(llm),
    });
    useSettingsStore.getState().updateTurbopuffer({
      ...turbopuffer,
      verifiedConfigSignature: serializeTurbopufferVerification(turbopuffer),
    });

    useSettingsStore.getState().updateLlm({ apiKey: "sk-next" });
    useSettingsStore.getState().updateTurbopuffer({ baseUrl: "https://staging.turbopuffer.com" });

    expect(useSettingsStore.getState().llm.verifiedConfigSignature).toBe("");
    expect(
      useSettingsStore.getState().turbopuffer.verifiedConfigSignature,
    ).toBe("");
  });
});
