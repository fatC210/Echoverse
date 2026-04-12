import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import * as llmService from "@/lib/services/llm";
import { DEFAULT_SETTINGS } from "@/lib/constants/defaults";
import { useSettingsStore } from "@/lib/store/settings-store";
import SettingsPage from "./SettingsPage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");

  const createMotionComponent = (tag: keyof React.JSX.IntrinsicElements) =>
    ReactModule.forwardRef<HTMLElement, Record<string, unknown>>(
      function MockMotionComponent(
        {
          animate: _animate,
          children,
          exit: _exit,
          initial: _initial,
          transition: _transition,
          whileHover: _whileHover,
          whileTap: _whileTap,
          ...props
        },
        ref,
      ) {
        return ReactModule.createElement(tag, { ...props, ref }, children);
      },
    );

  return {
    motion: {
      div: createMotionComponent("div"),
      span: createMotionComponent("span"),
    },
  };
});

vi.mock("@/lib/services/llm", () => ({
  testLlmConnection: vi.fn(),
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      isHydrated: true,
    });
    vi.mocked(llmService.testLlmConnection).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useSettingsStore.getState().clearAll();
  });

  it("revalidates after re-entering the same LLM API key", async () => {
    const { container } = render(<SettingsPage />);
    const llmApiKeyInput = container.querySelector("#llm-api-key");

    expect(llmApiKeyInput).toBeInstanceOf(HTMLInputElement);

    const llmInput = llmApiKeyInput as HTMLInputElement;

    await act(async () => {
      fireEvent.change(llmInput, { target: { value: "sk-test" } });
    });
    await waitFor(() => {
      expect(llmInput).toHaveValue("sk-test");
    });
    await act(async () => {
      fireEvent.blur(llmInput, { relatedTarget: null });
    });

    await waitFor(() => {
      expect(llmService.testLlmConnection).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      fireEvent.change(llmInput, { target: { value: "" } });
    });
    await waitFor(() => {
      expect(llmInput).toHaveValue("");
    });
    await act(async () => {
      fireEvent.blur(llmInput, { relatedTarget: null });
    });

    await waitFor(() => {
      expect(llmInput).toHaveValue("");
      expect(useSettingsStore.getState().llm.apiKey).toBe("");
      expect(useSettingsStore.getState().llm.verifiedConfigSignature).toBe("");
    });
    expect(llmService.testLlmConnection).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.change(llmInput, { target: { value: "sk-test" } });
    });
    await waitFor(() => {
      expect(llmInput).toHaveValue("sk-test");
    });
    await act(async () => {
      fireEvent.blur(llmInput, { relatedTarget: null });
    });

    await waitFor(() => {
      expect(llmService.testLlmConnection).toHaveBeenCalledTimes(2);
    });
  });
});
