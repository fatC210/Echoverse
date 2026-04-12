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
import { createStoryRecord, generateWorldState } from "@/lib/engine/world-generator";
import type {
  AudioAsset,
  Segment,
  Story,
  WorldGenerationInput,
} from "@/lib/types/echoverse";

export async function createStoryExperience(
  settings: EchoSettings,
  input: WorldGenerationInput,
) {
  const worldState = await generateWorldState(settings, input);
  const story = createStoryRecord(input, worldState);

  await putStory(story);
  await putPlayerProfile(createEmptyPlayerProfile(story.id));

  for (const tag of input.selectedCustomTags) {
    await upsertCustomTag(tag);
  }

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
  const previousSegments = await listSegmentsByStory(story.id);
  const previousDecisions = await listDecisionsByStory(story.id);
  const profile = (await getPlayerProfile(story.id)) ?? createEmptyPlayerProfile(story.id);
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
    await putDecision(decision);
    await putPlayerProfile(nextProfile);
  }

  const audioScript = await generateStorySegment(settings, {
    story,
    previousSegments: await listSegmentsByStory(story.id),
    previousDecisions: await listDecisionsByStory(story.id),
    playerProfile: nextProfile,
    selectedAction: options?.selectedAction
      ? {
          choiceId: options.selectedAction.choiceId,
          choiceText: options.selectedAction.choiceText,
          isFreeText: options.selectedAction.isFreeText,
        }
      : null,
    mode: options?.mode ?? "normal",
  });

  const segment = createSegmentRecord(story.id, audioScript);
  const resolved = await resolveSegmentAudio(settings, story, segment);
  await putSegment(resolved.segment);

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
      story.totalDurationSec +
      (resolved.segment.resolvedAudio?.narrationAssetId
        ? (
            await listStoryAssetMap(story.id)
          )[resolved.segment.resolvedAudio.narrationAssetId]?.durationSec ?? 0
        : 0),
    totalDecisions: options?.selectedAction ? story.totalDecisions + 1 : story.totalDecisions,
    cacheHitCount: story.cacheHitCount + resolved.cacheHitCount,
    cacheMissCount: story.cacheMissCount + resolved.cacheMissCount,
    updatedAt: new Date().toISOString(),
  } satisfies Story;

  await putStory(nextStory);

  return {
    story: nextStory,
    segment: resolved.segment,
    playerProfile: nextProfile,
    assets: await listStoryAssetMap(story.id),
  };
}
