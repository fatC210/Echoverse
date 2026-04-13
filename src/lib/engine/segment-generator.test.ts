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
    expect(result.music).not.toBeNull();
    expect(result.music?.description).toContain("Pure instrumental background score.");
    expect(result.choices).toHaveLength(2);
    expect(result.choices[0].text).toBe("Move forward carefully");
    expect(result.choices[1].text).toBe("Probe the anomaly directly");
  });

  it("advances chapter guidance using completed decisions instead of raw segment count", async () => {
    vi.mocked(generateStructuredJson).mockResolvedValue({
      chapter: "chapter_2",
      chapter_title: "   ",
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
      choices: [],
    });

    const result = await generateStorySegment(DEFAULT_SETTINGS, {
      ...baseInput,
      story: {
        ...baseStory,
        currentSegmentIndex: 99,
        worldState: {
          ...baseStory.worldState,
          chapters: [
            {
              id: "chapter_1",
              title: "The Wake",
              summary: "Mira realizes the relay is answering first.",
              target_mood: "mystery",
              target_choices: 1,
            },
            {
              id: "chapter_2",
              title: "The Pursuit",
              summary: "She follows the source deeper into the station.",
              target_mood: "tension",
              target_choices: 1,
            },
            {
              id: "chapter_3",
              title: "The Signal",
              summary: "The station asks to be opened.",
              target_mood: "horror",
              target_choices: 1,
            },
          ],
        },
      },
      previousDecisions: [
        {
          id: "decision_1",
          storyId: "story_1",
          segmentId: "segment_1",
          chapterId: "chapter_1",
          choiceId: "choice_1",
          choiceText: "Go after the source",
          riskLevel: "medium",
          traitSignal: "analytical",
          timeToDecideMs: 12000,
          timestamp: "2026-01-01T00:01:00.000Z",
        },
      ],
    });

    expect(result.chapter_title).toBe("The Pursuit");
    expect(result.narration.text).toContain('The story moves into "The Pursuit".');
  });

  it("backfills scene-fitting instrumental music when the model omits or blanks the music description", async () => {
    vi.mocked(generateStructuredJson).mockResolvedValue({
      chapter: "chapter_1",
      chapter_title: "The First Reply",
      mood_color: "tension",
      emotion_arc: "pressure builds",
      is_ending: false,
      ending_name: null,
      narration: {
        text: "The relay room listens back.",
        voice_style: "close, immersive, restrained",
      },
      sfx_layers: [],
      music: {
        description: "   ",
        duration_sec: 64,
        volume: 0.55,
        transition: "",
      },
      state_updates: [],
      choices: [],
    });

    const result = await generateStorySegment(DEFAULT_SETTINGS, baseInput);

    expect(result.music).toEqual({
      description: expect.stringContaining("Pure instrumental background score."),
      duration_sec: 64,
      volume: 0.55,
      transition: "crossfade_from_previous_4s",
    });
    expect(result.music?.description).toContain("minimal ambient");
    expect(result.music?.description).toContain("detuned chime");
  });

  it("keeps narration text untouched while preserving structured voice cues for playback", async () => {
    vi.mocked(generateStructuredJson).mockResolvedValue({
      chapter: "chapter_1",
      chapter_title: "The First Reply",
      mood_color: "mystery",
      emotion_arc: "tension rises",
      is_ending: false,
      ending_name: null,
      narration: {
        text: "The room goes silent for one impossible beat.",
        voice_style: "close, immersive, restrained",
        voice_cues: [
          {
            kind: "narration",
            text: "The room goes silent for one impossible beat.",
            speaker: null,
          },
          {
            kind: "dialogue",
            text: "Do not open that hatch.",
            speaker: "ARIA",
          },
        ],
      },
      sfx_layers: [],
      music: null,
      state_updates: [],
      choices: [],
    });

    const result = await generateStorySegment(DEFAULT_SETTINGS, baseInput);

    expect(result.narration.text).toBe("The room goes silent for one impossible beat.");
    expect(result.narration.voice_cues).toEqual([
      {
        kind: "narration",
        text: "The room goes silent for one impossible beat.",
        speaker: null,
      },
      {
        kind: "dialogue",
        text: "Do not open that hatch.",
        speaker: "ARIA",
      },
    ]);
  });

  it("includes retrieved turbopuffer context in the segment prompt when available", async () => {
    vi.mocked(generateStructuredJson).mockResolvedValue({
      chapter: "chapter_1",
      chapter_title: "The First Reply",
      mood_color: "mystery",
      emotion_arc: "tension rises",
      is_ending: false,
      ending_name: null,
      narration: {
        text: "The relay room listens back.",
        voice_style: "close, immersive, restrained",
      },
      sfx_layers: [],
      music: null,
      state_updates: [],
      choices: [],
    });

    await generateStorySegment(DEFAULT_SETTINGS, {
      ...baseInput,
      retrievalContext: {
        queryText: "probe the relay core",
        semanticMatches: [
          {
            id: "location:relay_core",
            source: "semantic",
            type: "location",
            label: "Relay Core",
            text: "A chamber full of heat and unstable signal glass.",
            score: 0.94,
          },
        ],
        keywordMatches: [],
        decisionMatches: [],
      },
    });

    expect(generateStructuredJson).toHaveBeenCalledWith(
      DEFAULT_SETTINGS.llm,
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("\"retrieved_memory\""),
        }),
      ]),
      expect.any(Object),
    );
    expect(generateStructuredJson).toHaveBeenCalledWith(
      DEFAULT_SETTINGS.llm,
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Relay Core"),
        }),
      ]),
      expect.any(Object),
    );
  });

  it("passes custom player input through the prompt as a free-text action", async () => {
    vi.mocked(generateStructuredJson).mockResolvedValue({
      chapter: "chapter_1",
      chapter_title: "The First Reply",
      mood_color: "mystery",
      emotion_arc: "tension rises",
      is_ending: false,
      ending_name: null,
      narration: {
        text: "The relay room listens back.",
        voice_style: "close, immersive, restrained",
      },
      sfx_layers: [],
      music: null,
      state_updates: [],
      choices: [],
    });

    await generateStorySegment(DEFAULT_SETTINGS, {
      ...baseInput,
      selectedAction: {
        choiceId: "free_text",
        choiceText: "Ask the signal to answer in my mother's voice.",
        isFreeText: true,
      },
    });

    expect(generateStructuredJson).toHaveBeenCalledWith(
      DEFAULT_SETTINGS.llm,
      expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("selected_action.source is free_text"),
        }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("\"source\":\"free_text\""),
        }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Ask the signal to answer in my mother's voice."),
        }),
      ]),
      expect.any(Object),
    );
  });

  it("tells the model to separate opening cues from sustained ambience", async () => {
    vi.mocked(generateStructuredJson).mockResolvedValue({
      chapter: "chapter_1",
      chapter_title: "The First Reply",
      mood_color: "mystery",
      emotion_arc: "tension rises",
      is_ending: false,
      ending_name: null,
      narration: {
        text: "The relay room listens back.",
        voice_style: "close, immersive, restrained",
      },
      sfx_layers: [],
      music: null,
      state_updates: [],
      choices: [],
    });

    await generateStorySegment(DEFAULT_SETTINGS, baseInput);

    expect(generateStructuredJson).toHaveBeenCalledWith(
      DEFAULT_SETTINGS.llm,
      expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("After any opening cue, let music.description carry the middle and end of the segment"),
        }),
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("place that one-shot moment in sfx_layers near the start"),
        }),
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("narration.voice_cues is a separate playback script"),
        }),
      ]),
      expect.any(Object),
    );
  });

  it("tolerates incomplete persisted world state while building the prompt", async () => {
    vi.mocked(generateStructuredJson).mockResolvedValue({
      chapter: "chapter_1",
      chapter_title: "The First Reply",
      mood_color: "mystery",
      emotion_arc: "tension rises",
      is_ending: false,
      ending_name: null,
      narration: {
        text: "The relay room listens back.",
        voice_style: "close, immersive, restrained",
      },
      sfx_layers: [],
      music: null,
      state_updates: [],
      choices: [],
    });

    const incompleteStory = structuredClone(baseStory);
    incompleteStory.worldState.chapters = [
      {
        ...incompleteStory.worldState.chapters[0],
        summary: undefined as unknown as string,
      },
    ];
    incompleteStory.worldState.characters = [
      {
        id: "character_1",
        name: "Jonah",
        role: "technician",
        personality: undefined as unknown as string,
        relationship_to_protagonist: "former friend",
        voice_description: "low and tense",
      },
    ];
    incompleteStory.worldState.locations = [
      {
        id: "relay_core",
        name: "Relay Core",
        description: undefined as unknown as string,
        atmosphere: "hot metal and static",
        connected_to: undefined as unknown as string[],
        sfx_hints: "",
        discoverable_items: [],
      },
    ];
    incompleteStory.worldState.items = [
      {
        id: "glass_key",
        name: "Glass Key",
        description: "A warm shard etched with moving text.",
        narrative_function: undefined as unknown as string,
        discoverable: true,
      },
    ];
    incompleteStory.worldState.notes = [undefined as unknown as string];

    const result = await generateStorySegment(DEFAULT_SETTINGS, {
      ...baseInput,
      story: incompleteStory,
    });

    expect(result.narration.text).toBe("The relay room listens back.");
    expect(generateStructuredJson).toHaveBeenCalledTimes(1);
  });
});
