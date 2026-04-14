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
const getCurrentTimeMock = vi.fn(() => 0);

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
    getCurrentTime: getCurrentTimeMock,
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

const baseAssets = {
  tts_1: {
    id: "tts_1",
    storyId: "story-1",
    category: "tts",
    description: "Narration",
    audioBlob: new Blob(["audio"], { type: "audio/mpeg" }),
    durationSec: 4,
    createdAt: "2026-04-14T00:00:00.000Z",
    timesUsed: 1,
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
    getCurrentTimeMock.mockReset();
    getCurrentTimeMock.mockReturnValue(0);
    window.localStorage.clear();

    vi.mocked(db.getStory).mockResolvedValue(baseStory);
    vi.mocked(db.listSegmentsByStory).mockResolvedValue([baseSegment]);
    vi.mocked(storyRuntime.listStoryAssetMap).mockResolvedValue(baseAssets);
    vi.mocked(storyRuntime.advanceStory).mockResolvedValue({
      story: baseStory,
      segment: {
        ...baseSegment,
        id: "segment-2",
      },
      assets: baseAssets,
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

  it("retries autoplay cleanly when the page is mounted under strict mode", async () => {
    playSegmentMock.mockResolvedValue({
      narrationDurationSec: 1,
      completion: Promise.resolve(),
    });

    await act(async () => {
      render(
        <React.StrictMode>
          <PlayerPage />
        </React.StrictMode>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(playSegmentMock).toHaveBeenCalled();
    });

    expect(
      await screen.findByRole("button", { name: /open the door/i }),
    ).toBeInTheDocument();
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

  it("shows choices after the text reveal finishes even when narration audio is unavailable", async () => {
    vi.useFakeTimers();

    vi.mocked(db.listSegmentsByStory).mockResolvedValue([
      {
        ...baseSegment,
        resolvedAudio: undefined,
        audioStatus: {
          ...baseSegment.audioStatus,
          tts: "failed",
        },
      } as never,
    ]);

    await act(async () => {
      render(<PlayerPage />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(playSegmentMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /open the door/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(6_100);
      await Promise.resolve();
    });

    expect(
      screen.getByRole("button", { name: /open the door/i }),
    ).toBeInTheDocument();
  });

  it("falls back to showing choices when narration completion never resolves", async () => {
    vi.useFakeTimers();

    playSegmentMock.mockResolvedValue({
      narrationDurationSec: 1,
      completion: new Promise<void>(() => {
        // Simulate browsers occasionally missing the final completion callback.
      }),
    });

    await act(async () => {
      render(<PlayerPage />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.queryByRole("button", { name: /open the door/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2_600);
      await Promise.resolve();
    });

    expect(
      screen.getByRole("button", { name: /open the door/i }),
    ).toBeInTheDocument();
  });

  it("falls back to showing choices when segment playback never starts", async () => {
    vi.useFakeTimers();

    playSegmentMock.mockImplementation(
      () =>
        new Promise(() => {
          // Simulate audio decoding / scheduling getting stuck before playSegment resolves.
        }),
    );

    await act(async () => {
      render(<PlayerPage />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.queryByRole("button", { name: /open the door/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1_200);
      await Promise.resolve();
    });

    expect(
      screen.getByRole("button", { name: /open the door/i }),
    ).toBeInTheDocument();
  });
});
