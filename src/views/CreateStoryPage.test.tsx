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
    ReactModule.forwardRef<HTMLElement, Record<string, unknown> & { children?: React.ReactNode }>(
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
  generateLlmText: vi.fn(),
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
      premise:
        "A courier discovers a suitcase that arrives one day before every disaster. When the case appears with her own address on it, she has one night to learn who is sending warnings from tomorrow.",
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
      "When no tags are provided, randomly invent the genre, atmosphere, protagonist identity, and central conflict yourself",
    );
    expect(messages[1].content).toContain(
      "The user selected no tags. Randomly generate one original story premise and return JSON only.",
    );
    expect(options).toMatchObject({ temperature: 1, max_tokens: 260 });

    await waitFor(() => {
      expect(
        screen.getByDisplayValue(
          "A courier discovers a suitcase that arrives one day before every disaster. When the case appears with her own address on it, she has one night to learn who is sending warnings from tomorrow.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("feeds selected tags into structured premise generation guidance", async () => {
    vi.mocked(llmService.generateStructuredJson).mockResolvedValue({
      premise:
        "A frightened detective wakes alone on a drifting station and must reopen a murder case before the life-support cycle ends. Each emergency signal he traces was sent by the next victim, including one transmission stamped with his own badge number.",
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

    await act(async () => {
      fireEvent.click(screen.getByTitle("AI Generate Premise"));
    });

    await waitFor(() => {
      expect(llmService.generateStructuredJson).toHaveBeenCalledTimes(1);
    });

    const [, messages, options] = vi.mocked(llmService.generateStructuredJson).mock.calls[0];

    expect(messages[0].content).toContain(
      "When tags are provided, use them to build the premise",
    );
    expect(messages[1].content).toContain(
      "Space, Horror",
    );
    expect(messages[1].content).toContain(
      "use these tags to build the story premise",
    );
    expect(options).toMatchObject({ temperature: 0.85, max_tokens: 260 });
  });

  it("passes preset and custom tags together into premise generation", async () => {
    vi.mocked(llmService.generateStructuredJson).mockResolvedValue({
      premise:
        "A station mechanic agrees to relive the same evacuation drill until she finds the missing passenger everyone else keeps forgetting. On the final loop, the abandoned deck starts answering her over the intercom in her own voice.",
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
      fireEvent.change(screen.getByPlaceholderText("Type a custom tag, press Enter to add..."), {
        target: { value: "Time Loop" },
      });
      fireEvent.keyDown(screen.getByPlaceholderText("Type a custom tag, press Enter to add..."), {
        key: "Enter",
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle("AI Generate Premise"));
    });

    await waitFor(() => {
      expect(llmService.generateStructuredJson).toHaveBeenCalledTimes(1);
    });

    const [, messages] = vi.mocked(llmService.generateStructuredJson).mock.calls[0];
    expect(messages[1].content).toContain("Space, Time Loop (custom)");
  });

  it("uses interface language instead of story language for premise generation", async () => {
    vi.mocked(llmService.generateStructuredJson).mockResolvedValue({
      premise:
        "一名废墟勘测员在失联的高塔里寻找失踪的搭档。可每上一层，她都会先听见自己明天才会发出的求救录音。",
    });

    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      llm: {
        ...DEFAULT_SETTINGS.llm,
        apiKey: "sk-test",
      },
      preferences: {
        interfaceLang: "zh",
        storyLang: "en",
      },
      isHydrated: true,
    });

    render(<CreateStoryPage />);

    await act(async () => {
      fireEvent.click(screen.getByTitle("AI 生成故事前提"));
    });

    await waitFor(() => {
      expect(llmService.generateStructuredJson).toHaveBeenCalledTimes(1);
    });

    const [, messages] = vi.mocked(llmService.generateStructuredJson).mock.calls[0];
    expect(messages[0].content).toContain("你是 Echoverse 的故事前提写作者");
    expect(messages[0].content).toContain("必须写成 2 到 3 句话");
  });

  it("retries once when the model returns parseable JSON but not a display-ready premise", async () => {
    vi.mocked(llmService.generateStructuredJson)
      .mockResolvedValueOnce({
        premise: "Output format: write exactly 2 to 3 sentences.",
      })
      .mockResolvedValueOnce({
        premise:
          "A cartographer discovers the city redraws one alley each night to hide a door meant for tomorrow's missing residents. When the new map labels her apartment as the final destination, she has until dawn to learn who is being moved out of time.",
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
      expect(llmService.generateStructuredJson).toHaveBeenCalledTimes(2);
    });

    const [, retryMessages, retryOptions] = vi.mocked(llmService.generateStructuredJson).mock.calls[1];
    expect(retryMessages[1].content).toContain("parseable JSON, but the premise was still not display-ready");
    expect(retryOptions).toMatchObject({ temperature: 0.75, max_tokens: 260 });

    await waitFor(() => {
      expect(
        screen.getByDisplayValue(
          "A cartographer discovers the city redraws one alley each night to hide a door meant for tomorrow's missing residents. When the new map labels her apartment as the final destination, she has until dawn to learn who is being moved out of time.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("fills the textarea without an error toast when plain-text fallback recovers a usable premise", async () => {
    vi.mocked(llmService.generateStructuredJson).mockRejectedValue(
      new Error("Could not parse JSON from model response"),
    );
    vi.mocked(llmService.generateLlmText).mockResolvedValue(
      "Premise: A museum night guard finds a gallery label for a portrait that has not been painted yet. When the blank frame starts reflecting tomorrow's visitors, she realizes the missing artist has already chosen her final pose.",
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
      expect(
        screen.getByDisplayValue(
          "A museum night guard finds a gallery label for a portrait that has not been painted yet. When the blank frame starts reflecting tomorrow's visitors, she realizes the missing artist has already chosen her final pose.",
        ),
      ).toBeInTheDocument();
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(llmService.generateLlmText).toHaveBeenCalledTimes(1);
  });
});
