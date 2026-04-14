import type { EchoSettings } from "@/lib/constants/defaults";
import {
  getPlayerProfile,
  listAudioAssetsByStory,
  listDecisionsByStory,
  listSegmentsByStory,
  putDecision,
  putPlayerProfile,
  putSegment,
  putStory,
  upsertCustomTag,
} from "@/lib/db";
import { resolveSegmentAudio } from "@/lib/engine/audio-resolver";
import {
  createSegmentRecord,
  generateStorySegment,
  applyWorldStateUpdates,
} from "@/lib/engine/segment-generator";
import {
  buildDecisionRecord,
  createEmptyPlayerProfile,
  updatePlayerProfile,
} from "@/lib/engine/player-profile";
import {
  retrieveStoryContext,
  syncDecisionMemory,
  syncPlayerProfileMemory,
  syncStoryWorldMemory,
} from "@/lib/engine/turbopuffer-memory";
import { createStoryRecord, generateWorldState } from "@/lib/engine/world-generator";
import type {
  AudioAsset,
  Segment,
  Story,
  WorldGenerationInput,
} from "@/lib/types/echoverse";
import { getNarrationDurationSec } from "@/lib/utils/narration";

function runInBackground(task: Promise<unknown>, label: string) {
  void Promise.resolve(task).catch((error) => {
    console.warn(`${label} failed in background.`, {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

function resolveGenerationMode(
  story: Story,
  options?: {
    selectedAction?: {
      choiceId: string;
      choiceText: string;
      riskLevel: "low" | "medium" | "high";
      isFreeText: boolean;
      timeToDecideMs: number;
    } | null;
    mode?: "normal" | "end_story" | "continue_after_ending";
  },
) {
  const requestedMode = options?.mode ?? "normal";

  if (requestedMode !== "normal" || story.continuedAfterEnding || !options?.selectedAction) {
    return requestedMode;
  }

  const chapterTarget = story.worldState.chapters?.length ?? 0;
  const configuredTarget = story.worldState.story_rules.total_target_choices;
  const targetChoices =
    typeof configuredTarget === "number" && configuredTarget > 0
      ? configuredTarget
      : chapterTarget;
  const projectedDecisionCount = story.totalDecisions + 1;

  return targetChoices > 0 && projectedDecisionCount >= targetChoices
    ? "end_story"
    : requestedMode;
}

export type AdvanceStoryStage = "retrieval_context" | "generate_segment" | "resolve_audio";

type AdvanceStoryOptions = {
  selectedAction?: {
    choiceId: string;
    choiceText: string;
    riskLevel: "low" | "medium" | "high";
    isFreeText: boolean;
    timeToDecideMs: number;
  } | null;
  mode?: "normal" | "end_story" | "continue_after_ending";
  onStageChange?: (stage: AdvanceStoryStage) => void;
};

export async function createStoryExperience(
  settings: EchoSettings,
  input: WorldGenerationInput,
) {
  const worldState = await generateWorldState(settings, input);
  const story = createStoryRecord(input, worldState);
  const initialProfile = createEmptyPlayerProfile(story.id);

  await putStory(story);
  await putPlayerProfile(initialProfile);
  await Promise.all(input.selectedCustomTags.map((tag) => upsertCustomTag(tag)));

  runInBackground(syncStoryWorldMemory(settings, story), "Story world sync");
  runInBackground(
    syncPlayerProfileMemory(settings, story, initialProfile),
    "Player profile sync",
  );

  return story;
}

export async function listStoryAssetMap(storyId: string) {
  const assets = await listAudioAssetsByStory(storyId);
  return assets.reduce<Record<string, AudioAsset>>((accumulator, asset) => {
    accumulator[asset.id] = asset;
    return accumulator;
  }, {});
}

export async function advanceStory(
  settings: EchoSettings,
  story: Story,
  options?: AdvanceStoryOptions,
) {
  const generationMode = resolveGenerationMode(story, options);
  const [previousSegments, previousDecisions, storedProfile] = await Promise.all([
    listSegmentsByStory(story.id),
    listDecisionsByStory(story.id),
    getPlayerProfile(story.id),
  ]);
  const profile = storedProfile ?? createEmptyPlayerProfile(story.id);
  let nextProfile = profile;
  const currentSegment = previousSegments[previousSegments.length - 1];

  if (options?.selectedAction && currentSegment) {
    const choiceMade = {
      choiceId: options.selectedAction.choiceId,
      choiceText: options.selectedAction.choiceText,
      isFreeText: options.selectedAction.isFreeText,
      timestamp: new Date().toISOString(),
      timeToDecideMs: options.selectedAction.timeToDecideMs,
    };

    const updatedCurrentSegment: Segment = {
      ...currentSegment,
      choiceMade,
    };
    await putSegment(updatedCurrentSegment);

    const decision = buildDecisionRecord({
      storyId: story.id,
      segmentId: currentSegment.id,
      chapterId: currentSegment.chapterId,
      choiceId: options.selectedAction.choiceId,
      choiceText: options.selectedAction.choiceText,
      riskLevel: options.selectedAction.riskLevel,
      timeToDecideMs: options.selectedAction.timeToDecideMs,
    });

    nextProfile = updatePlayerProfile(profile, decision);
    await Promise.all([putDecision(decision), putPlayerProfile(nextProfile)]);
    runInBackground(syncDecisionMemory(settings, story, decision), "Decision memory sync");
    runInBackground(
      syncPlayerProfileMemory(settings, story, nextProfile),
      "Player profile sync",
    );
  }

  const [previousSegmentsForPrompt, previousDecisionsForPrompt] = await Promise.all([
    listSegmentsByStory(story.id),
    listDecisionsByStory(story.id),
  ]);
  options?.onStageChange?.("retrieval_context");
  const retrievalContext = await retrieveStoryContext(settings, {
    story,
    previousSegments: previousSegmentsForPrompt,
    previousDecisions: previousDecisionsForPrompt,
    selectedAction: options?.selectedAction
      ? {
          choiceId: options.selectedAction.choiceId,
          choiceText: options.selectedAction.choiceText,
          isFreeText: options.selectedAction.isFreeText,
        }
      : null,
  });

  options?.onStageChange?.("generate_segment");
  const audioScript = await generateStorySegment(settings, {
    story,
    previousSegments: previousSegmentsForPrompt,
    previousDecisions: previousDecisionsForPrompt,
    playerProfile: nextProfile,
    retrievalContext,
    selectedAction: options?.selectedAction
      ? {
          choiceId: options.selectedAction.choiceId,
          choiceText: options.selectedAction.choiceText,
          isFreeText: options.selectedAction.isFreeText,
        }
      : null,
    mode: generationMode,
  });

  const segment = createSegmentRecord(story.id, audioScript);
  options?.onStageChange?.("resolve_audio");
  const resolved = await resolveSegmentAudio(settings, story, segment);
  await putSegment(resolved.segment);
  const assets = await listStoryAssetMap(story.id);

  const nextStory = {
    ...story,
    worldState: applyWorldStateUpdates(story.worldState, audioScript),
    currentChapter: audioScript.chapter,
    currentSegmentIndex: story.currentSegmentIndex + 1,
    status: audioScript.is_ending ? "completed" : "playing",
    endingName: audioScript.ending_name ?? story.endingName,
    continuedAfterEnding:
      options?.mode === "continue_after_ending" ? true : story.continuedAfterEnding,
    totalDurationSec:
      story.totalDurationSec + getNarrationDurationSec(resolved.segment, assets),
    totalDecisions: options?.selectedAction ? story.totalDecisions + 1 : story.totalDecisions,
    cacheHitCount: story.cacheHitCount + resolved.cacheHitCount,
    cacheMissCount: story.cacheMissCount + resolved.cacheMissCount,
    updatedAt: new Date().toISOString(),
  } satisfies Story;

  await putStory(nextStory);
  runInBackground(syncStoryWorldMemory(settings, nextStory), "Story world sync");
  runInBackground(
    syncPlayerProfileMemory(settings, nextStory, nextProfile),
    "Player profile sync",
  );

  return {
    story: nextStory,
    segment: resolved.segment,
    playerProfile: nextProfile,
    assets,
  };
}
