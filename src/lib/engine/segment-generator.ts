import { generateStructuredJson } from "@/lib/services/llm";
import type { EchoSettings } from "@/lib/constants/defaults";
import type {
  AudioScript,
  Decision,
  Segment,
  SegmentGenerationInput,
  Story,
  WorldState,
} from "@/lib/types/echoverse";
import { createId } from "@/lib/utils/echoverse";

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

const VALID_MOOD_COLORS = new Set<AudioScript["mood_color"]>([
  "dread",
  "wonder",
  "tension",
  "peace",
  "horror",
  "adventure",
  "joy",
  "melancholy",
  "mystery",
]);

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function normalizeMoodColor(value: unknown, fallback: AudioScript["mood_color"] = "mystery") {
  return typeof value === "string" && VALID_MOOD_COLORS.has(value as AudioScript["mood_color"])
    ? (value as AudioScript["mood_color"])
    : fallback;
}

function getFallbackChoiceTemplates(language: WorldState["story_rules"]["story_language"]) {
  if (language === "zh") {
    return [
      {
        text: "谨慎向前推进",
        hint: "先确认眼前变化的来源",
        risk: "low" as const,
        unlocks: "更多线索",
      },
      {
        text: "主动试探异常",
        hint: "直接接触最可疑的目标",
        risk: "medium" as const,
        unlocks: "新的反应",
      },
      {
        text: "冒险打破僵局",
        hint: "用更激进的方式改变局面",
        risk: "high" as const,
        unlocks: "高风险结果",
      },
    ];
  }

  return [
    {
      text: "Move forward carefully",
      hint: "Take a measured step and gather context first",
      risk: "low" as const,
      unlocks: "more clues",
    },
    {
      text: "Probe the anomaly directly",
      hint: "Test the most suspicious lead head-on",
      risk: "medium" as const,
      unlocks: "a new reaction",
    },
    {
      text: "Break the stalemate with a gamble",
      hint: "Force the situation to change now",
      risk: "high" as const,
      unlocks: "a risky outcome",
    },
  ];
}

function buildFallbackNarration(
  story: Story,
  chapterPlan: ReturnType<typeof getCurrentChapterPlan>,
  mode: SegmentGenerationInput["mode"],
  selectedAction?: SegmentGenerationInput["selectedAction"] | null,
) {
  const language = story.worldState.story_rules.story_language;
  const protagonist = normalizeText(
    story.worldState.protagonist.name,
    language === "zh" ? "主角" : "the protagonist",
  );
  const chapterTitle = normalizeText(
    chapterPlan.title,
    language === "zh" ? "下一章" : "the next chapter",
  );
  const summary = normalizeText(chapterPlan.summary, story.premise);
  const latestAction = normalizeText(selectedAction?.choiceText);

  if (language === "zh") {
    if (mode === "end_story") {
      return `故事来到“${chapterTitle}”。${summary} 所有线索都在此收束，${protagonist}必须面对这段旅程最终留下的结果。`;
    }

    if (latestAction) {
      return `在做出“${latestAction}”这个决定后，故事进入“${chapterTitle}”。${summary} 局势正在迅速变化，${protagonist}必须马上判断下一步。`;
    }

    return `故事进入“${chapterTitle}”。${summary} 周围的迹象正在逼近答案，而${protagonist}必须立刻决定下一步。`;
  }

  if (mode === "end_story") {
    return `The story reaches "${chapterTitle}". ${summary} Every thread is converging here, and ${protagonist} has to face what this journey has finally become.`;
  }

  if (latestAction) {
    return `After choosing to ${latestAction}, the story moves into "${chapterTitle}". ${summary} The situation is changing fast, and ${protagonist} has to decide what to do next.`;
  }

  return `The story moves into "${chapterTitle}". ${summary} The pressure is building, and ${protagonist} needs to decide what to do next.`;
}

function getCurrentChapterPlan(story: Story) {
  return (
    story.worldState.chapters[story.currentSegmentIndex] ??
    story.worldState.chapters[story.worldState.chapters.length - 1] ??
    {
      id: story.currentChapter,
      title: story.currentChapter,
      summary: story.premise,
      target_mood: "mystery",
      target_choices: 3,
    }
  );
}

function summarizeHistory(segments: Segment[], decisions: Decision[]) {
  const recentSegments = segments.slice(-2).map((segment) => ({
    chapter: segment.audioScript.chapter_title,
    narration: compactText(segment.audioScript.narration.text, 220),
    choiceMade: segment.choiceMade?.choiceText
      ? compactText(segment.choiceMade.choiceText, 80)
      : null,
    isEnding: segment.audioScript.is_ending,
  }));

  const recentDecisions = decisions.slice(-3).map((decision) => ({
    choiceText: compactText(decision.choiceText, 80),
    riskLevel: decision.riskLevel,
    traitSignal: decision.traitSignal,
  }));

  return {
    recentSegments,
    recentDecisions,
  };
}

function summarizeWorldState(worldState: WorldState) {
  return {
    title: worldState.title,
    genre: worldState.genre,
    tone: worldState.tone,
    setting: worldState.setting,
    protagonist: worldState.protagonist,
    chapter_outline: worldState.chapters.slice(0, 8).map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      summary: compactText(chapter.summary, 120),
      target_mood: chapter.target_mood,
      target_choices: chapter.target_choices,
    })),
    characters: worldState.characters.slice(0, 4).map((character) => ({
      id: character.id,
      name: character.name,
      role: character.role,
      relationship_to_protagonist: character.relationship_to_protagonist,
      personality: compactText(character.personality, 80),
    })),
    locations: worldState.locations.slice(0, 5).map((location) => ({
      id: location.id,
      name: location.name,
      atmosphere: compactText(location.atmosphere, 80),
      description: compactText(location.description, 100),
      connected_to: location.connected_to.slice(0, 4),
    })),
    items: worldState.items.slice(0, 6).map((item) => ({
      id: item.id,
      name: item.name,
      narrative_function: compactText(item.narrative_function, 80),
      discoverable: item.discoverable,
    })),
    sonic_dna: worldState.sonic_dna,
    notes: (worldState.notes ?? []).slice(0, 4).map((note) => compactText(note, 100)),
  };
}

function normalizeAudioScript(
  raw: Partial<AudioScript>,
  story: Story,
  options?: Pick<SegmentGenerationInput, "mode" | "selectedAction">,
) {
  const chapterPlan = getCurrentChapterPlan(story);
  const language = story.worldState.story_rules.story_language;
  const fallbackMood = normalizeMoodColor(chapterPlan.target_mood);
  const isEnding =
    typeof raw.is_ending === "boolean" ? raw.is_ending : options?.mode === "end_story";
  const fallbackNarration = buildFallbackNarration(
    story,
    chapterPlan,
    options?.mode ?? "normal",
    options?.selectedAction,
  );
  const fallbackChoices = getFallbackChoiceTemplates(language);
  const normalizedChoices = (isEnding ? [] : raw.choices ?? [])
    .slice(0, 3)
    .map((choice, index) => {
      const fallbackChoice = fallbackChoices[index] ?? fallbackChoices[fallbackChoices.length - 1];
      return {
        id: normalizeText(choice.id, `choice_${index + 1}`),
        text: normalizeText(choice.text, fallbackChoice.text),
        hint: normalizeText(choice.hint, fallbackChoice.hint),
        risk:
          choice.risk === "low" || choice.risk === "medium" || choice.risk === "high"
            ? choice.risk
            : fallbackChoice.risk,
        unlocks: normalizeText(choice.unlocks, fallbackChoice.unlocks),
      };
    })
    .filter((choice) => Boolean(choice.text));

  while (!isEnding && normalizedChoices.length < 2) {
    const index = normalizedChoices.length;
    const fallbackChoice = fallbackChoices[index] ?? fallbackChoices[fallbackChoices.length - 1];
    normalizedChoices.push({
      id: `choice_${index + 1}`,
      text: fallbackChoice.text,
      hint: fallbackChoice.hint,
      risk: fallbackChoice.risk,
      unlocks: fallbackChoice.unlocks,
    });
  }

  return {
    segment_id: raw.segment_id ?? createId("segment"),
    chapter: raw.chapter ?? chapterPlan.id,
    chapter_title: normalizeText(raw.chapter_title, chapterPlan.title),
    mood_color: normalizeMoodColor(raw.mood_color, fallbackMood),
    emotion_arc: normalizeText(raw.emotion_arc, chapterPlan.summary),
    is_ending: isEnding,
    ending_name: raw.ending_name ?? null,
    narration: {
      text: normalizeText(raw.narration?.text, fallbackNarration),
      voice_style: normalizeText(
        raw.narration?.voice_style,
        language === "zh" ? "贴耳、沉浸、克制" : "close, immersive, restrained",
      ),
    },
    sfx_layers: (raw.sfx_layers ?? []).map((layer, index) => ({
      id: normalizeText(layer.id, `sfx_${index + 1}`),
      start_sec: layer.start_sec ?? 0,
      description: normalizeText(layer.description),
      duration_sec: layer.duration_sec ?? 8,
      looping: layer.looping ?? false,
      volume: layer.volume ?? 0.3,
    })),
    music: raw.music
      ? {
          description: normalizeText(raw.music.description),
          duration_sec: raw.music.duration_sec ?? 45,
          volume: raw.music.volume ?? 0.4,
          transition: normalizeText(raw.music.transition, "crossfade_from_previous_4s"),
        }
      : null,
    state_updates: raw.state_updates ?? [],
    choices: normalizedChoices,
  } satisfies AudioScript;
}

export async function generateStorySegment(
  settings: EchoSettings,
  input: SegmentGenerationInput,
) {
  const chapterPlan = getCurrentChapterPlan(input.story);
  const { recentSegments, recentDecisions } = summarizeHistory(
    input.previousSegments,
    input.previousDecisions,
  );
  const worldSummary = summarizeWorldState(input.story.worldState);
  const mode = input.mode ?? "normal";
  const latestAction = input.selectedAction
    ? `${input.selectedAction.choiceText} (${input.selectedAction.isFreeText ? "free_text" : input.selectedAction.choiceId})`
    : "story start";

  const systemPrompt = `You are Echoverse's segment generator.
You must continue an interactive audio story and return a single valid JSON object only.

Rules:
- narration.text must be written in ${input.story.worldState.story_rules.story_language}.
- sfx_layers[].description and music.description must always be in English.
- Provide 2 or 3 choices unless this is an ending.
- Keep the story moving forward. Never stall or refuse a reasonable user action.
- Each segment should feel like 35-90 seconds of narration.
- Keep the JSON compact.
- narration.text should usually stay within 110-180 words.
- Use at most 2 sfx layers unless a third layer is essential.
- Keep music.description, emotion_arc, hints, and unlocks brief.
- Use the chapter plan as guidance, not as a rigid script.
- If mode is end_story, produce a natural ending with is_ending=true and no choices.
- If mode is continue_after_ending, start a fresh arc from the established ending state.

Return JSON only with this shape:
{
  "segment_id": "string",
  "chapter": "string",
  "chapter_title": "string",
  "mood_color": "dread|wonder|tension|peace|horror|adventure|joy|melancholy|mystery",
  "emotion_arc": "string",
  "is_ending": false,
  "ending_name": null,
  "narration": {
    "text": "string",
    "voice_style": "string"
  },
  "sfx_layers": [{
    "id": "string",
    "start_sec": 0,
    "description": "string",
    "duration_sec": 12,
    "looping": false,
    "volume": 0.3
  }],
  "music": {
    "description": "string",
    "duration_sec": 50,
    "volume": 0.4,
    "transition": "crossfade_from_previous_4s"
  },
  "state_updates": [{
    "entity_id": "string",
    "updates": {}
  }],
  "choices": [{
    "id": "string",
    "text": "string",
    "hint": "string",
    "risk": "low|medium|high",
    "unlocks": "string"
  }]
}`;

  const userPrompt = `Generate the next story segment from this compact JSON context:
${JSON.stringify({
    mode,
    latest_action: compactText(latestAction, 120),
    premise: compactText(input.story.premise, 220),
    current_chapter_plan: {
      ...chapterPlan,
      summary: compactText(chapterPlan.summary, 120),
    },
    player_profile: input.playerProfile,
    recent_history: { recentSegments, recentDecisions },
    world_summary: worldSummary,
  })}`;

  const raw = await generateStructuredJson<AudioScript>(
    settings.llm,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.45,
      max_tokens: 1400,
    },
  );

  return normalizeAudioScript(raw, input.story, {
    mode,
    selectedAction: input.selectedAction,
  });
}

export function applyWorldStateUpdates(worldState: WorldState, audioScript: AudioScript) {
  const next = structuredClone(worldState);

  for (const update of audioScript.state_updates) {
    const target =
      next.characters.find((item) => item.id === update.entity_id) ??
      next.locations.find((item) => item.id === update.entity_id) ??
      next.items.find((item) => item.id === update.entity_id);

    if (target) {
      Object.assign(target, update.updates);
    }
  }

  return next;
}

export function createSegmentRecord(storyId: string, audioScript: AudioScript) {
  return {
    id: audioScript.segment_id || createId("segment"),
    storyId,
    chapterId: audioScript.chapter,
    audioScript,
    audioStatus: {
      tts: "pending",
      sfx: audioScript.sfx_layers.map(() => "pending"),
      music: audioScript.music ? "pending" : "failed",
    },
    resolvedAudio: {
      sfxAssetIds: [],
    },
    createdAt: new Date().toISOString(),
  } satisfies Segment;
}
