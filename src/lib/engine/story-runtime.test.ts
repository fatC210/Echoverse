import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/constants/defaults";
import type { AudioScript, Segment, Story, WorldState } from "@/lib/types/echoverse";
import { advanceStory, createStoryExperience } from "./story-runtime";

vi.mock("@/lib/db", () => ({
  getPlayerProfile: vi.fn(),
  listAudioAssetsByStory: vi.fn().mockResolvedValue([]),
  listDecisionsByStory: vi.fn(),
  listSegmentsByStory: vi.fn(),
  putDecision: vi.fn(),
  putPlayerProfile: vi.fn(),
  putSegment: vi.fn(),
  putStory: vi.fn(),
  upsertCustomTag: vi.fn(),
}));

vi.mock("@/lib/engine/audio-resolver", () => ({
  resolveSegmentAudio: vi.fn(),
}));

vi.mock("@/lib/engine/segment-generator", () => ({
  applyWorldStateUpdates: vi.fn(),
  createSegmentRecord: vi.fn(),
  generateStorySegment: vi.fn(),
}));

vi.mock("@/lib/engine/player-profile", () => ({
  buildDecisionRecord: vi.fn(),
  createEmptyPlayerProfile: vi.fn(),
  updatePlayerProfile: vi.fn(),
}));

vi.mock("@/lib/engine/turbopuffer-memory", () => ({
  retrieveStoryContext: vi.fn(),
  syncDecisionMemory: vi.fn(),
  syncPlayerProfileMemory: vi.fn(),
  syncStoryWorldMemory: vi.fn(),
}));

vi.mock("@/lib/engine/world-generator", () => ({
  createStoryRecord: vi.fn(),
  generateWorldState: vi.fn(),
}));

describe("story runtime turbopuffer integration", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("syncs world and profile memory when a story is created", async () => {
    const { putPlayerProfile, putStory, upsertCustomTag } = await import("@/lib/db");
    const { createEmptyPlayerProfile } = await import("@/lib/engine/player-profile");
    const { syncPlayerProfileMemory, syncStoryWorldMemory } = await import(
      "@/lib/engine/turbopuffer-memory"
    );
    const { createStoryRecord, generateWorldState } = await import("@/lib/engine/world-generator");
    const worldState = {
      title: "Echo Station",
      genre: "Mystery",
      tone: "tense",
      setting: {
        location: "Relay station",
        era: "near future",
        atmosphere: "Static and fluorescent light",
      },
      protagonist: {
        name: "Mira",
        role: "engineer",
        personality: "careful",
        motivation: "survive",
        wound: "isolation",
      },
      characters: [],
      locations: [],
      items: [],
      sonic_dna: {
        palette: ["static"],
        music_style: "ambient",
        avoid: [],
        signature_sound: "detuned bell",
      },
      chapters: [],
      story_rules: {
        story_language: "en",
        total_target_choices: 3,
      },
    } satisfies WorldState;
    const story = {
      id: "story_1",
      title: "Echo Station",
      genre: "Mystery",
      tags: {
        preset: ["space"],
        custom: ["time loop"],
      },
      premise: "A signal responds before Mira speaks.",
      worldState,
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
    } satisfies Story;
    const profile = {
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
    } as const;

    vi.mocked(generateWorldState).mockResolvedValue(worldState);
    vi.mocked(createStoryRecord).mockReturnValue(story);
    vi.mocked(createEmptyPlayerProfile).mockReturnValue(profile);

    await createStoryExperience(DEFAULT_SETTINGS, {
      premise: story.premise,
      selectedPresetTags: ["space"],
      selectedCustomTags: ["time loop"],
      storyLanguage: "en",
      duration: "short",
    });

    expect(putStory).toHaveBeenCalledWith(story);
    expect(putPlayerProfile).toHaveBeenCalledWith(profile);
    expect(upsertCustomTag).toHaveBeenCalledWith("time loop");
    expect(syncStoryWorldMemory).toHaveBeenCalledWith(DEFAULT_SETTINGS, story);
    expect(syncPlayerProfileMemory).toHaveBeenCalledWith(DEFAULT_SETTINGS, story, profile);
  });

  it("retrieves turbopuffer context before generating the next segment", async () => {
    const {
      getPlayerProfile,
      listDecisionsByStory,
      listSegmentsByStory,
      putDecision,
      putPlayerProfile,
      putSegment,
      putStory,
    } = await import("@/lib/db");
    const { resolveSegmentAudio } = await import("@/lib/engine/audio-resolver");
    const {
      applyWorldStateUpdates,
      createSegmentRecord,
      generateStorySegment,
    } = await import("@/lib/engine/segment-generator");
    const { buildDecisionRecord, updatePlayerProfile } = await import(
      "@/lib/engine/player-profile"
    );
    const {
      retrieveStoryContext,
      syncDecisionMemory,
      syncPlayerProfileMemory,
      syncStoryWorldMemory,
    } = await import("@/lib/engine/turbopuffer-memory");

    const worldState = {
      title: "Echo Station",
      genre: "Mystery",
      tone: "tense",
      setting: {
        location: "Relay station",
        era: "near future",
        atmosphere: "Static and fluorescent light",
      },
      protagonist: {
        name: "Mira",
        role: "engineer",
        personality: "careful",
        motivation: "survive",
        wound: "isolation",
      },
      characters: [],
      locations: [],
      items: [],
      sonic_dna: {
        palette: ["static"],
        music_style: "ambient",
        avoid: [],
        signature_sound: "detuned bell",
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
    } satisfies WorldState;
    const story = {
      id: "story_1",
      title: "Echo Station",
      genre: "Mystery",
      tags: {
        preset: ["space"],
        custom: [],
      },
      premise: "A signal responds before Mira speaks.",
      worldState,
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
    } satisfies Story;
    const currentSegment = {
      id: "segment_1",
      storyId: "story_1",
      chapterId: "chapter_1",
      audioScript: {
        segment_id: "segment_1",
        chapter: "chapter_1",
        chapter_title: "The First Reply",
        mood_color: "mystery",
        emotion_arc: "tension rises",
        is_ending: false,
        ending_name: null,
        narration: {
          text: "A voice answers from inside the static.",
          voice_style: "close",
        },
        sfx_layers: [],
        music: null,
        state_updates: [],
        choices: [],
      },
      audioStatus: {
        tts: "ready",
        sfx: [],
        music: "failed",
      },
      resolvedAudio: {
        sfxAssetIds: [],
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    } satisfies Segment;
    const decision = {
      id: "decision_1",
      storyId: "story_1",
      segmentId: "segment_1",
      chapterId: "chapter_1",
      choiceId: "choice_1",
      choiceText: "Probe the anomaly directly",
      riskLevel: "medium",
      traitSignal: "analytical",
      timeToDecideMs: 15000,
      timestamp: "2026-01-01T00:01:00.000Z",
    } as const;
    const profile = {
      id: "current",
      storyId: "story_1",
      brave: 0,
      cautious: 0,
      empathetic: 0,
      analytical: 1,
      avgDecisionTimeMs: 15000,
      preferredPacing: "moderate",
      scareTolerance: "medium",
      totalDecisions: 1,
      updatedAt: "2026-01-01T00:01:00.000Z",
    } as const;
    const retrievalContext = {
      queryText: "Probe the anomaly directly near the relay core",
      semanticMatches: [],
      keywordMatches: [],
      decisionMatches: [],
    } as const;
    const nextAudioScript = {
      segment_id: "segment_2",
      chapter: "chapter_1",
      chapter_title: "The First Reply",
      mood_color: "mystery",
      emotion_arc: "the signal becomes intimate",
      is_ending: false,
      ending_name: null,
      narration: {
        text: "The relay room exhales a warmer pulse.",
        voice_style: "close",
      },
      sfx_layers: [],
      music: null,
      state_updates: [],
      choices: [],
    } satisfies AudioScript;
    const nextSegment = {
      ...currentSegment,
      id: "segment_2",
      audioScript: nextAudioScript,
      createdAt: "2026-01-01T00:02:00.000Z",
    } satisfies Segment;
    const updatedWorldState = {
      ...worldState,
      notes: ["The relay core is reacting to direct contact."],
    };

    vi.mocked(listSegmentsByStory).mockResolvedValue([currentSegment]);
    vi.mocked(listDecisionsByStory).mockResolvedValue([]);
    vi.mocked(getPlayerProfile).mockResolvedValue(profile);
    vi.mocked(buildDecisionRecord).mockReturnValue(decision);
    vi.mocked(updatePlayerProfile).mockReturnValue(profile);
    vi.mocked(retrieveStoryContext).mockResolvedValue(retrievalContext);
    vi.mocked(generateStorySegment).mockResolvedValue(nextAudioScript);
    vi.mocked(createSegmentRecord).mockReturnValue(nextSegment);
    vi.mocked(resolveSegmentAudio).mockResolvedValue({
      segment: nextSegment,
      cacheHitCount: 1,
      cacheMissCount: 0,
    });
    vi.mocked(applyWorldStateUpdates).mockReturnValue(updatedWorldState);

    await advanceStory(DEFAULT_SETTINGS, story, {
      selectedAction: {
        choiceId: "choice_1",
        choiceText: "Probe the anomaly directly",
        riskLevel: "medium",
        isFreeText: false,
        timeToDecideMs: 15000,
      },
    });

    expect(putSegment).toHaveBeenCalled();
    expect(putDecision).toHaveBeenCalledWith(decision);
    expect(putPlayerProfile).toHaveBeenCalledWith(profile);
    expect(syncDecisionMemory).toHaveBeenCalledWith(DEFAULT_SETTINGS, story, decision);
    expect(retrieveStoryContext).toHaveBeenCalled();
    expect(generateStorySegment).toHaveBeenCalledWith(
      DEFAULT_SETTINGS,
      expect.objectContaining({
        retrievalContext,
      }),
    );
    expect(putStory).toHaveBeenCalled();
    expect(syncStoryWorldMemory).toHaveBeenCalled();
    expect(syncPlayerProfileMemory).toHaveBeenCalled();
  });

  it("adds the duration of multi-cue narration when a segment contains character voice switches", async () => {
    const {
      getPlayerProfile,
      listAudioAssetsByStory,
      listDecisionsByStory,
      listSegmentsByStory,
      putStory,
    } = await import("@/lib/db");
    const { resolveSegmentAudio } = await import("@/lib/engine/audio-resolver");
    const {
      applyWorldStateUpdates,
      createSegmentRecord,
      generateStorySegment,
    } = await import("@/lib/engine/segment-generator");
    const { createEmptyPlayerProfile } = await import("@/lib/engine/player-profile");
    const { retrieveStoryContext } = await import("@/lib/engine/turbopuffer-memory");

    const worldState = {
      title: "Echo Station",
      genre: "Mystery",
      tone: "tense",
      setting: {
        location: "Relay station",
        era: "near future",
        atmosphere: "Static and fluorescent light",
      },
      protagonist: {
        name: "Mira",
        role: "engineer",
        personality: "careful",
        motivation: "survive",
        wound: "isolation",
      },
      characters: [],
      locations: [],
      items: [],
      sonic_dna: {
        palette: ["static"],
        music_style: "ambient",
        avoid: [],
        signature_sound: "detuned bell",
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
    } satisfies WorldState;
    const story = {
      id: "story_1",
      title: "Echo Station",
      genre: "Mystery",
      tags: {
        preset: ["space"],
        custom: [],
      },
      premise: "A signal responds before Mira speaks.",
      worldState,
      status: "playing",
      currentChapter: "chapter_1",
      currentSegmentIndex: 0,
      continuedAfterEnding: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      totalDurationSec: 10,
      totalDecisions: 0,
      cacheHitCount: 0,
      cacheMissCount: 0,
    } satisfies Story;
    const nextAudioScript = {
      segment_id: "segment_2",
      chapter: "chapter_1",
      chapter_title: "The First Reply",
      mood_color: "mystery",
      emotion_arc: "the signal becomes intimate",
      is_ending: false,
      ending_name: null,
      narration: {
        text: 'Mira freezes. ARIA says, "Do not open that hatch."',
        voice_style: "close",
      },
      sfx_layers: [],
      music: null,
      state_updates: [],
      choices: [],
    } satisfies AudioScript;
    const nextSegment = {
      id: "segment_2",
      storyId: "story_1",
      chapterId: "chapter_1",
      audioScript: nextAudioScript,
      audioStatus: {
        tts: "ready",
        sfx: [],
        music: "failed",
      },
      resolvedAudio: {
        narrationCues: [
          {
            assetId: "tts_1",
            text: "Mira freezes.",
            kind: "narration",
            voiceId: "voice_narrator",
          },
          {
            assetId: "tts_2",
            text: "Do not open that hatch.",
            kind: "dialogue",
            voiceId: "voice_aria",
            speaker: "ARIA",
          },
        ],
        sfxAssetIds: [],
      },
      createdAt: "2026-01-01T00:02:00.000Z",
    } satisfies Segment;

    vi.mocked(listSegmentsByStory).mockResolvedValue([]);
    vi.mocked(listDecisionsByStory).mockResolvedValue([]);
    vi.mocked(getPlayerProfile).mockResolvedValue(null);
    vi.mocked(createEmptyPlayerProfile).mockReturnValue({
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
    });
    vi.mocked(retrieveStoryContext).mockResolvedValue({
      queryText: "",
      semanticMatches: [],
      keywordMatches: [],
      decisionMatches: [],
    });
    vi.mocked(generateStorySegment).mockResolvedValue(nextAudioScript);
    vi.mocked(createSegmentRecord).mockReturnValue(nextSegment);
    vi.mocked(resolveSegmentAudio).mockResolvedValue({
      segment: nextSegment,
      cacheHitCount: 0,
      cacheMissCount: 0,
    });
    vi.mocked(applyWorldStateUpdates).mockReturnValue(worldState);
    vi.mocked(listAudioAssetsByStory).mockResolvedValue([
      {
        id: "tts_1",
        storyId: "story_1",
        category: "tts",
        description: "Narration 1",
        audioBlob: new Blob(["a"]),
        durationSec: 1.25,
        looping: false,
        mood: "mystery",
        createdAt: "2026-01-01T00:00:00.000Z",
        timesUsed: 1,
      },
      {
        id: "tts_2",
        storyId: "story_1",
        category: "tts",
        description: "Narration 2",
        audioBlob: new Blob(["b"]),
        durationSec: 2.75,
        looping: false,
        mood: "mystery",
        createdAt: "2026-01-01T00:00:00.000Z",
        timesUsed: 1,
      },
    ]);

    await advanceStory(DEFAULT_SETTINGS, story);

    expect(putStory).toHaveBeenCalledWith(
      expect.objectContaining({
        totalDurationSec: 14,
      }),
    );
  });

  it("auto-generates an ending once the target choice count is reached", async () => {
    const {
      getPlayerProfile,
      listDecisionsByStory,
      listSegmentsByStory,
      putStory,
    } = await import("@/lib/db");
    const { resolveSegmentAudio } = await import("@/lib/engine/audio-resolver");
    const {
      applyWorldStateUpdates,
      createSegmentRecord,
      generateStorySegment,
    } = await import("@/lib/engine/segment-generator");
    const { buildDecisionRecord, updatePlayerProfile } = await import(
      "@/lib/engine/player-profile"
    );
    const { retrieveStoryContext } = await import("@/lib/engine/turbopuffer-memory");

    const worldState = {
      title: "Echo Station",
      genre: "Mystery",
      tone: "tense",
      setting: {
        location: "Relay station",
        era: "near future",
        atmosphere: "Static and fluorescent light",
      },
      protagonist: {
        name: "Mira",
        role: "engineer",
        personality: "careful",
        motivation: "survive",
        wound: "isolation",
      },
      characters: [],
      locations: [],
      items: [],
      sonic_dna: {
        palette: ["static"],
        music_style: "ambient",
        avoid: [],
        signature_sound: "detuned bell",
      },
      chapters: [
        {
          id: "chapter_1",
          title: "The First Reply",
          summary: "A transmission answers before Mira finishes speaking.",
          target_mood: "mystery",
          target_choices: 1,
        },
        {
          id: "chapter_2",
          title: "The Signal",
          summary: "The relay asks for a final response.",
          target_mood: "tension",
          target_choices: 1,
        },
      ],
      story_rules: {
        story_language: "en",
        total_target_choices: 2,
      },
    } satisfies WorldState;
    const story = {
      id: "story_1",
      title: "Echo Station",
      genre: "Mystery",
      tags: {
        preset: ["space"],
        custom: [],
      },
      premise: "A signal responds before Mira speaks.",
      worldState,
      status: "playing",
      currentChapter: "chapter_2",
      currentSegmentIndex: 2,
      continuedAfterEnding: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      totalDurationSec: 10,
      totalDecisions: 1,
      cacheHitCount: 0,
      cacheMissCount: 0,
    } satisfies Story;
    const currentSegment = {
      id: "segment_2",
      storyId: "story_1",
      chapterId: "chapter_2",
      audioScript: {
        segment_id: "segment_2",
        chapter: "chapter_2",
        chapter_title: "The Signal",
        mood_color: "tension",
        emotion_arc: "the station corners Mira",
        is_ending: false,
        ending_name: null,
        narration: {
          text: "The relay waits for Mira's final answer.",
          voice_style: "close",
        },
        sfx_layers: [],
        music: null,
        state_updates: [],
        choices: [],
      },
      audioStatus: {
        tts: "ready",
        sfx: [],
        music: "failed",
      },
      resolvedAudio: {
        sfxAssetIds: [],
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    } satisfies Segment;
    const decision = {
      id: "decision_2",
      storyId: "story_1",
      segmentId: "segment_2",
      chapterId: "chapter_2",
      choiceId: "choice_1",
      choiceText: "Broadcast the warning",
      riskLevel: "high",
      traitSignal: "brave",
      timeToDecideMs: 8000,
      timestamp: "2026-01-01T00:02:00.000Z",
    } as const;
    const profile = {
      id: "current",
      storyId: "story_1",
      brave: 1,
      cautious: 0,
      empathetic: 0,
      analytical: 0,
      avgDecisionTimeMs: 8000,
      preferredPacing: "moderate",
      scareTolerance: "medium",
      totalDecisions: 2,
      updatedAt: "2026-01-01T00:02:00.000Z",
    } as const;
    const endingAudioScript = {
      segment_id: "segment_3",
      chapter: "chapter_2",
      chapter_title: "The Signal",
      mood_color: "tension",
      emotion_arc: "the warning escapes the station",
      is_ending: true,
      ending_name: "Open Circuit",
      narration: {
        text: "Mira sends the warning and the relay finally goes quiet.",
        voice_style: "close",
      },
      sfx_layers: [],
      music: null,
      state_updates: [],
      choices: [],
    } satisfies AudioScript;
    const endingSegment = {
      ...currentSegment,
      id: "segment_3",
      audioScript: endingAudioScript,
      createdAt: "2026-01-01T00:03:00.000Z",
    } satisfies Segment;

    vi.mocked(listSegmentsByStory).mockResolvedValue([currentSegment]);
    vi.mocked(listDecisionsByStory).mockResolvedValue([decision]);
    vi.mocked(getPlayerProfile).mockResolvedValue(profile);
    vi.mocked(buildDecisionRecord).mockReturnValue(decision);
    vi.mocked(updatePlayerProfile).mockReturnValue(profile);
    vi.mocked(retrieveStoryContext).mockResolvedValue({
      queryText: "Broadcast the warning",
      semanticMatches: [],
      keywordMatches: [],
      decisionMatches: [],
    });
    vi.mocked(generateStorySegment).mockResolvedValue(endingAudioScript);
    vi.mocked(createSegmentRecord).mockReturnValue(endingSegment);
    vi.mocked(resolveSegmentAudio).mockResolvedValue({
      segment: endingSegment,
      cacheHitCount: 0,
      cacheMissCount: 0,
    });
    vi.mocked(applyWorldStateUpdates).mockReturnValue(worldState);

    await advanceStory(DEFAULT_SETTINGS, story, {
      selectedAction: {
        choiceId: "choice_1",
        choiceText: "Broadcast the warning",
        riskLevel: "high",
        isFreeText: false,
        timeToDecideMs: 8000,
      },
    });

    expect(generateStorySegment).toHaveBeenCalledWith(
      DEFAULT_SETTINGS,
      expect.objectContaining({
        mode: "end_story",
      }),
    );
    expect(putStory).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        endingName: "Open Circuit",
      }),
    );
  });
});
