import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DEFAULT_SETTINGS } from "@/lib/constants/defaults";
import { useSettingsStore } from "@/lib/store/settings-store";
import {
  serializeLlmVerification,
  serializeTurbopufferVerification,
} from "@/lib/utils/settings-validation";
import * as db from "@/lib/db";
import * as storyRuntime from "@/lib/engine/story-runtime";
import * as llmService from "@/lib/services/llm";
import CreateStoryPage from "./CreateStoryPage";
import { toast } from "sonner";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
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
          whileInView: _whileInView,
          whileTap: _whileTap,
          viewport: _viewport,
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
      p: createMotionComponent("p"),
    },
  };
});

vi.mock("@/lib/db", () => ({
  listCustomTags: vi.fn(),
}));

vi.mock("@/lib/engine/story-runtime", () => ({
  advanceStory: vi.fn(),
  createStoryExperience: vi.fn(),
}));

vi.mock("@/lib/services/llm", () => ({
  generateStructuredJson: vi.fn(),
  LlmRequestError: class MockLlmRequestError extends Error {
    status: number;

    constructor(message: string, status = 0) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("CreateStoryPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    pushMock.mockReset();
    vi.mocked(db.listCustomTags).mockResolvedValue([]);
    vi.mocked(storyRuntime.createStoryExperience).mockResolvedValue({
      id: "story-1",
      worldState: { chapters: [{ id: "chapter-1" }] },
    } as never);
    vi.mocked(storyRuntime.advanceStory).mockResolvedValue({
      story: { id: "story-1" },
    } as never);

    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      isHydrated: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useSettingsStore.getState().clearAll();
  });

  it("keeps the start button actionable when required setup is missing", async () => {
    render(<CreateStoryPage />);

    const startButton = screen.getByRole("button", { name: "Begin Journey" });

    expect(startButton).toBeEnabled();

    await act(async () => {
      fireEvent.click(startButton);
    });

    expect(pushMock).toHaveBeenCalledWith("/settings");
    expect(storyRuntime.createStoryExperience).not.toHaveBeenCalled();
  });

  it("starts with empty tags and falls back to the placeholder premise", async () => {
    const llm = {
      ...DEFAULT_SETTINGS.llm,
      apiKey: "sk-test",
    };
    const turbopuffer = {
      ...DEFAULT_SETTINGS.turbopuffer,
      apiKey: "tp-test",
    };

    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      llm: {
        ...llm,
        verifiedConfigSignature: serializeLlmVerification(llm),
      },
      elevenlabs: {
        apiKey: "xi-test",
        verifiedApiKey: "xi-test",
      },
      turbopuffer: {
        ...turbopuffer,
        verifiedConfigSignature: serializeTurbopufferVerification(turbopuffer),
      },
      voice: {
        ...DEFAULT_SETTINGS.voice,
        voiceId: "voice-1",
      },
      isHydrated: true,
    });

    let resolveCreateStory!: (value: unknown) => void;
    let resolveAdvanceStory!: (value: unknown) => void;

    vi.mocked(storyRuntime.createStoryExperience).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreateStory = resolve;
        }) as never,
    );
    vi.mocked(storyRuntime.advanceStory).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAdvanceStory = resolve;
        }) as never,
    );

    await act(async () => {
      render(<CreateStoryPage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Begin Journey" }));
    });

    await waitFor(() => {
      expect(storyRuntime.createStoryExperience).toHaveBeenCalledTimes(1);
    });

    const worldInput = vi.mocked(storyRuntime.createStoryExperience).mock.calls[0][1];

    expect(worldInput.selectedPresetTags).toEqual([]);
    expect(worldInput.selectedCustomTags).toEqual([]);
    expect(worldInput.premise).toBe(
      "An astronaut wakes up alone on an abandoned space station. She needs to repair the communications system to call for rescue, but something else seems to be on the station...",
    );

    await act(async () => {
      resolveCreateStory({
        id: "story-1",
        worldState: { chapters: [{ id: "chapter-1" }] },
      });
    });

    await waitFor(() => {
      expect(storyRuntime.advanceStory).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveAdvanceStory({
        story: { id: "story-1" },
      });
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/play/story-1");
    });
  });

  it("shows a response-format error instead of blaming api config when premise parsing fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.mocked(llmService.generateStructuredJson).mockRejectedValue(
      new Error("Could not parse JSON from model response"),
    );

    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      llm: {
        ...DEFAULT_SETTINGS.llm,
        apiKey: "sk-test",
      },
      isHydrated: true,
    });

    render(<CreateStoryPage />);

    await act(async () => {
      fireEvent.click(screen.getByTitle("AI Generate Premise"));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "The model returned an invalid format. Try again.",
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("randomly generates a premise when no tags are selected", async () => {
    vi.mocked(llmService.generateStructuredJson).mockResolvedValue({
      premise: "A courier discovers a suitcase that keeps arriving one day before every disaster.",
    });

    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      llm: {
        ...DEFAULT_SETTINGS.llm,
        apiKey: "sk-test",
      },
      isHydrated: true,
    });

    render(<CreateStoryPage />);

    await act(async () => {
      fireEvent.click(screen.getByTitle("AI Generate Premise"));
    });

    await waitFor(() => {
      expect(llmService.generateStructuredJson).toHaveBeenCalledTimes(1);
    });

    const [, messages, options] = vi.mocked(llmService.generateStructuredJson).mock.calls[0];

    expect(messages[0].content).toContain(
      "The user selected no tags. You must randomly choose the genre, atmosphere, protagonist type, and central conflict yourself",
    );
    expect(messages[1].content).toContain(
      "The user selected no tags. Randomly generate one original, complete story premise",
    );
    expect(options).toMatchObject({ temperature: 1, max_tokens: 260 });
  });

  it("feeds selected tags into premise generation guidance", async () => {
    vi.mocked(llmService.generateStructuredJson).mockResolvedValue({
      premise: "A frightened detective on a drifting station realizes each emergency signal was sent by the next victim.",
    });

    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      llm: {
        ...DEFAULT_SETTINGS.llm,
        apiKey: "sk-test",
      },
      isHydrated: true,
    });

    render(<CreateStoryPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Space" }));
      fireEvent.click(screen.getByRole("button", { name: "Horror" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Space · Horror")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle("AI Generate Premise"));
    });

    await waitFor(() => {
      expect(llmService.generateStructuredJson).toHaveBeenCalledTimes(1);
    });

    const [, messages, options] = vi.mocked(llmService.generateStructuredJson).mock.calls[0];

    expect(messages[0].content).toContain(
      "You must actively use and naturally integrate these tags: Space, Horror",
    );
    expect(messages[1].content).toContain(
      "actively reflect these tags: Space, Horror",
    );
    expect(options).toMatchObject({ temperature: 0.85, max_tokens: 260 });
  });
});
