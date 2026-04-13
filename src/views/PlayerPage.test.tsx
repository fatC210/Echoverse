import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DEFAULT_SETTINGS } from "@/lib/constants/defaults";
import { useSettingsStore } from "@/lib/store/settings-store";
import * as db from "@/lib/db";
import * as storyRuntime from "@/lib/engine/story-runtime";
import PlayerPage from "./PlayerPage";

const pushMock = vi.fn();
const playSegmentMock = vi.fn();
const pauseMock = vi.fn();
const resumeMock = vi.fn();
const stopAllMock = vi.fn();
const setVolumesMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useParams: () => ({
    storyId: "story-1",
  }),
  useSearchParams: () => ({
    get: () => null,
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
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get: (_target, tag) => createMotionComponent(tag as keyof React.JSX.IntrinsicElements),
      },
    ),
  };
});

vi.mock("@/lib/db", () => ({
  getStory: vi.fn(),
  listSegmentsByStory: vi.fn(),
  putPlayerProfile: vi.fn(),
  putStory: vi.fn(),
}));

vi.mock("@/lib/engine/story-runtime", () => ({
  advanceStory: vi.fn(),
  listStoryAssetMap: vi.fn(),
}));

vi.mock("@/lib/engine/audio-mixer", () => ({
  getAudioMixer: () => ({
    pause: pauseMock,
    playSegment: playSegmentMock,
    resume: resumeMock,
    setVolumes: setVolumesMock,
    stopAll: stopAllMock,
  }),
}));

vi.mock("@/lib/engine/exporter", () => ({
  exportStoryAudioMp3: vi.fn(),
  exportStoryMarkdown: vi.fn(),
  exportWorldJson: vi.fn(),
}));

vi.mock("@/lib/services/elevenlabs", () => ({
  isElevenLabsVerified: vi.fn(() => false),
  listElevenLabsVoices: vi.fn(),
  previewElevenLabsVoice: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const baseStory = {
  id: "story-1",
  title: "Echoverse Test Story",
  status: "playing",
  currentChapter: "chapter-1",
  worldState: {
    chapters: [{ id: "chapter-1", title: "Chapter 1" }],
  },
} as never;

const baseSegment = {
  id: "segment-1",
  storyId: "story-1",
  audioScript: {
    chapter_title: "Chapter 1",
    chapter: "chapter-1",
    mood_color: "mystery",
    is_ending: false,
    narration: {
      text: "A quiet room waits for your next move.",
    },
    choices: [
      {
        id: "choice_1",
        text: "Open the door",
        hint: "Step into the hallway",
        risk: "low",
      },
    ],
    sfx_layers: [],
  },
  audioStatus: {
    tts: "ready",
    sfx: [],
    music: "failed",
  },
  resolvedAudio: {
    narrationAssetId: "tts_1",
    sfxAssetIds: [],
  },
} as never;

describe("PlayerPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    playSegmentMock.mockReset();
    pauseMock.mockReset();
    resumeMock.mockReset();
    stopAllMock.mockReset();
    setVolumesMock.mockReset();
    window.localStorage.clear();

    vi.mocked(db.getStory).mockResolvedValue(baseStory);
    vi.mocked(db.listSegmentsByStory).mockResolvedValue([baseSegment]);
    vi.mocked(storyRuntime.listStoryAssetMap).mockResolvedValue({});
    vi.mocked(storyRuntime.advanceStory).mockResolvedValue({
      story: baseStory,
      segment: {
        ...baseSegment,
        id: "segment-2",
      },
      assets: {},
    } as never);

    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      isHydrated: true,
      preferences: {
        ...DEFAULT_SETTINGS.preferences,
        interfaceLang: "en",
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
    useSettingsStore.getState().clearAll();
  });

  it("does not replay the same segment during rerenders, pause/resume, or choice wait state", async () => {
    let finishPlayback = () => {};

    playSegmentMock.mockImplementation(() => ({
      narrationDurationSec: 4,
      completion: new Promise<void>((resolve) => {
        finishPlayback = resolve;
      }),
    }));

    await act(async () => {
      render(<PlayerPage />);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(playSegmentMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(db.getStory).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    });

    expect(pauseMock).toHaveBeenCalledTimes(1);
    expect(playSegmentMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /resume/i }));
    });

    expect(resumeMock).toHaveBeenCalledTimes(1);
    expect(playSegmentMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishPlayback();
      await Promise.resolve();
    });

    await screen.findByRole("button", { name: /open the door/i });
    expect(playSegmentMock).toHaveBeenCalledTimes(1);
  });

  it("auto-selects only once when the countdown expires", async () => {
    vi.useFakeTimers();

    playSegmentMock.mockResolvedValue({
      narrationDurationSec: 1,
      completion: Promise.resolve(),
    });

    vi.mocked(storyRuntime.advanceStory).mockImplementation(
      () =>
        new Promise(() => {
          // Keep the request pending so duplicate submissions would be observable.
        }) as never,
    );

    await act(async () => {
      render(<PlayerPage />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: /open the door/i })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(storyRuntime.advanceStory).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(storyRuntime.advanceStory).toHaveBeenCalledTimes(1);
  });
});
