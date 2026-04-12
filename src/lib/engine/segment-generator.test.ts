import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/constants/defaults";
import type { SegmentGenerationInput, Story } from "@/lib/types/echoverse";
import { generateStructuredJson } from "@/lib/services/llm";
import { generateStorySegment } from "./segment-generator";

vi.mock("@/lib/services/llm", () => ({
  generateStructuredJson: vi.fn(),
}));

const baseStory: Story = {
  id: "story_1",
  title: "Echo Station",
  genre: "Mystery",
  tags: {
    preset: [],
    custom: [],
  },
  premise: "A signal begins answering questions that nobody has asked yet.",
  worldState: {
    title: "Echo Station",
    genre: "Mystery",
    tone: "tense",
    setting: {
      location: "A failing relay station",
      era: "near future",
      atmosphere: "thin static and cold fluorescent light",
    },
    protagonist: {
      name: "Mira",
      role: "relay engineer",
      personality: "careful but curious",
      motivation: "keep the station alive",
      wound: "she trusts signals more than people",
    },
    characters: [],
    locations: [],
    items: [],
    sonic_dna: {
      palette: ["static", "metal groan"],
      music_style: "minimal ambient",
      avoid: [],
      signature_sound: "detuned chime",
    },
    chapters: [
      {
        id: "chapter_1",
        title: "The First Reply",
        summary: "A transmission answers before Mira finishes speaking.",
        target_mood: "mystery",
        target_choices: 3,
      },
    ],
    story_rules: {
      story_language: "en",
      total_target_choices: 3,
    },
  },
  status: "playing",
  currentChapter: "chapter_1",
  currentSegmentIndex: 0,
  continuedAfterEnding: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  totalDurationSec: 0,
  totalDecisions: 0,
  cacheHitCount: 0,
  cacheMissCount: 0,
};

const baseInput: SegmentGenerationInput = {
  story: baseStory,
  previousSegments: [],
  previousDecisions: [],
  playerProfile: {
    id: "current",
    storyId: "story_1",
    brave: 0,
    cautious: 0,
    empathetic: 0,
    analytical: 0,
    avgDecisionTimeMs: 0,
    preferredPacing: "moderate",
    scareTolerance: "medium",
    totalDecisions: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  selectedAction: null,
  mode: "normal",
};

describe("generateStorySegment", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fills fallback narration and choices when the model returns empty segment fields", async () => {
    vi.mocked(generateStructuredJson).mockResolvedValue({
      chapter: "chapter_1",
      chapter_title: "The First Reply",
      mood_color: "mystery",
      emotion_arc: "",
      is_ending: false,
      ending_name: null,
      narration: {
        text: "   ",
        voice_style: "",
      },
      sfx_layers: [],
      music: null,
      state_updates: [],
      choices: [
        {
          id: "choice_1",
          text: "   ",
          hint: "",
          risk: "medium",
          unlocks: "",
        },
      ],
    });

    const result = await generateStorySegment(DEFAULT_SETTINGS, baseInput);

    expect(result.narration.text).toContain('The story moves into "The First Reply".');
    expect(result.narration.voice_style).toBe("close, immersive, restrained");
    expect(result.choices).toHaveLength(2);
    expect(result.choices[0].text).toBe("Move forward carefully");
    expect(result.choices[1].text).toBe("Probe the anomaly directly");
  });
});
