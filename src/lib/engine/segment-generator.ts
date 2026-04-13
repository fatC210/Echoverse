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

function compactText(value: unknown, maxLength: number, fallback = "") {
  const normalized = normalizeText(value, fallback).replace(/\s+/g, " ").trim();

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

const FALLBACK_MUSIC_ARCS: Record<
  AudioScript["mood_color"],
  {
    base: string;
    opening: string;
    middle: string;
    ending: string;
  }
> = {
  dread: {
    base: "low drones and distant pulses",
    opening: "begin almost empty with a low uneasy swell",
    middle: "thicken into heavier pressure without turning percussive",
    ending: "leave a cold unresolved tail hanging in the air",
  },
  wonder: {
    base: "shimmering pads and airy motifs",
    opening: "open with a soft luminous bloom",
    middle: "expand into gently rising harmonic motion",
    ending: "fade with suspended awe and space",
  },
  tension: {
    base: "tight pulses and restrained synth textures",
    opening: "start with a nervous pulse under the scene",
    middle: "build subtle forward motion and friction",
    ending: "hold the pressure instead of fully releasing it",
  },
  peace: {
    base: "warm ambient piano and soft pads",
    opening: "arrive quietly with slow breathing chords",
    middle: "stay steady and comforting with minimal movement",
    ending: "dissolve into a calm spacious fade",
  },
  horror: {
    base: "dark textures, bowed resonance, and sub bass air",
    opening: "creep in with a near-silent ominous bed",
    middle: "introduce unstable tones and widening dread",
    ending: "end on a lingering chill instead of a clean cadence",
  },
  adventure: {
    base: "cinematic rhythms and wide harmonic pads",
    opening: "enter with a sense of motion and scale",
    middle: "push forward with determined momentum",
    ending: "resolve into a poised, forward-looking lift",
  },
  joy: {
    base: "light rhythmic textures and bright instrumental layers",
    opening: "spark gently with a bright playful lift",
    middle: "stay buoyant and flowing without vocals",
    ending: "land in a warm uplifting glow",
  },
  melancholy: {
    base: "soft piano, distant strings, and muted ambience",
    opening: "begin with fragile intimate space",
    middle: "let the harmony deepen with reflective weight",
    ending: "trail away with tender unresolved sadness",
  },
  mystery: {
    base: "minimal ambient textures and suspended motifs",
    opening: "open with sparse intrigue and subtle movement",
    middle: "deepen the atmosphere with quiet unanswered tension",
    ending: "fade on an unresolved question",
  },
};

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function normalizeCueKind(value: unknown): "narration" | "dialogue" {
  return value === "dialogue" ? "dialogue" : "narration";
}

function normalizeMoodColor(value: unknown, fallback: AudioScript["mood_color"] = "mystery") {
  return typeof value === "string" && VALID_MOOD_COLORS.has(value as AudioScript["mood_color"])
    ? (value as AudioScript["mood_color"])
    : fallback;
}

function normalizeEnglishHint(value: unknown) {
  const normalized = normalizeText(value);
  return /[a-z]/i.test(normalized) ? normalized : "";
}

function joinDescriptionParts(parts: string[]) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildFallbackMusic(
  story: Story,
  mood: AudioScript["mood_color"],
) {
  const arc = FALLBACK_MUSIC_ARCS[mood] ?? FALLBACK_MUSIC_ARCS.mystery;
  const musicStyle = normalizeEnglishHint(story.worldState.sonic_dna.music_style);
  const signatureSound = normalizeEnglishHint(story.worldState.sonic_dna.signature_sound);
  const tone = normalizeEnglishHint(story.worldState.tone);
  const genre = normalizeEnglishHint(story.worldState.genre);
  const sceneDescriptor = [genre, tone].filter(Boolean).join(", ");

  return joinDescriptionParts([
    "Pure instrumental background score.",
    musicStyle
      ? `Lean into ${musicStyle} with ${arc.base}.`
      : `Use ${arc.base} for the bed.`,
    signatureSound ? `Thread in a restrained ${signatureSound} motif when it feels natural.` : "",
    sceneDescriptor ? `Keep it suitable for a ${sceneDescriptor} scene.` : "Keep it immersive and scene-driven.",
    `${arc.opening}, ${arc.middle}, and ${arc.ending}.`,
  ]);
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

function getChapterProgressIndex(
  story: Story,
  options?: Pick<SegmentGenerationInput, "previousDecisions">,
) {
  const chapters = story.worldState.chapters ?? [];

  if (chapters.length === 0) {
    return 0;
  }

  const completedDecisionCount = Math.max(
    story.totalDecisions,
    options?.previousDecisions?.length ?? 0,
  );

  return Math.min(Math.max(completedDecisionCount, 0), chapters.length - 1);
}

function getCurrentChapterPlan(
  story: Story,
  options?: Pick<SegmentGenerationInput, "previousDecisions">,
) {
  const chapters = story.worldState.chapters ?? [];
  const chapterIndex = getChapterProgressIndex(story, options);

  return (
    chapters[chapterIndex] ??
    chapters[chapters.length - 1] ??
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
  const chapters = worldState.chapters ?? [];
  const characters = worldState.characters ?? [];
  const locations = worldState.locations ?? [];
  const items = worldState.items ?? [];

  return {
    title: normalizeText(worldState.title, "Untitled Echo"),
    genre: normalizeText(worldState.genre, "Interactive Fiction"),
    tone: normalizeText(worldState.tone, "immersive"),
    setting: worldState.setting,
    protagonist: worldState.protagonist,
    chapter_outline: chapters.slice(0, 8).map((chapter) => ({
      id: normalizeText(chapter.id),
      title: normalizeText(chapter.title),
      summary: compactText(chapter.summary, 120),
      target_mood: chapter.target_mood,
      target_choices: chapter.target_choices,
    })),
    characters: characters.slice(0, 4).map((character) => ({
      id: normalizeText(character.id),
      name: normalizeText(character.name),
      role: normalizeText(character.role),
      relationship_to_protagonist: normalizeText(character.relationship_to_protagonist),
      personality: compactText(character.personality, 80),
    })),
    locations: locations.slice(0, 5).map((location) => ({
      id: normalizeText(location.id),
      name: normalizeText(location.name),
      atmosphere: compactText(location.atmosphere, 80),
      description: compactText(location.description, 100),
      connected_to: (location.connected_to ?? []).slice(0, 4),
    })),
    items: items.slice(0, 6).map((item) => ({
      id: normalizeText(item.id),
      name: normalizeText(item.name),
      narrative_function: compactText(item.narrative_function, 80),
      discoverable: item.discoverable,
    })),
    sonic_dna: worldState.sonic_dna,
    notes: (worldState.notes ?? []).slice(0, 4).map((note) => compactText(note, 100)),
  };
}

function summarizeRetrievalContext(input: SegmentGenerationInput["retrievalContext"]) {
  if (!input) {
    return null;
  }

  return {
    query: compactText(input.queryText, 180),
    semantic_matches: (input.semanticMatches ?? []).slice(0, 4).map((match) => ({
      type: normalizeText(match.type),
      label: normalizeText(match.label),
      text: compactText(match.text, 120),
      score: match.score,
    })),
    keyword_matches: (input.keywordMatches ?? []).slice(0, 3).map((match) => ({
      type: normalizeText(match.type),
      label: normalizeText(match.label),
      text: compactText(match.text, 120),
    })),
    decision_matches: (input.decisionMatches ?? []).slice(0, 3).map((match) => ({
      label: normalizeText(match.label),
      text: compactText(match.text, 120),
      timestamp: match.timestamp,
    })),
  };
}

function normalizeAudioScript(
  raw: Partial<AudioScript>,
  story: Story,
  options?: Pick<SegmentGenerationInput, "mode" | "selectedAction" | "previousDecisions">,
) {
  const chapterPlan = getCurrentChapterPlan(story, options);
  const language = story.worldState.story_rules.story_language;
  const fallbackMood = normalizeMoodColor(chapterPlan.target_mood);
  const normalizedMood = normalizeMoodColor(raw.mood_color, fallbackMood);
  const isEnding =
    typeof raw.is_ending === "boolean" ? raw.is_ending : options?.mode === "end_story";
  const fallbackNarration = buildFallbackNarration(
    story,
    chapterPlan,
    options?.mode ?? "normal",
    options?.selectedAction,
  );
  const fallbackMusic = buildFallbackMusic(story, normalizedMood);
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
    mood_color: normalizedMood,
    emotion_arc: normalizeText(raw.emotion_arc, chapterPlan.summary),
    is_ending: isEnding,
    ending_name: raw.ending_name ?? null,
    narration: {
      text: normalizeText(raw.narration?.text, fallbackNarration),
      voice_style: normalizeText(
        raw.narration?.voice_style,
        language === "zh" ? "贴耳、沉浸、克制" : "close, immersive, restrained",
      ),
      voice_cues: (raw.narration?.voice_cues ?? [])
        .map((cue) => ({
          kind: normalizeCueKind(cue?.kind),
          text: normalizeText(cue?.text),
          speaker: normalizeText(cue?.speaker ?? "", "") || null,
        }))
        .filter((cue) => Boolean(cue.text)),
    },
    sfx_layers: (raw.sfx_layers ?? []).map((layer, index) => ({
      id: normalizeText(layer.id, `sfx_${index + 1}`),
      start_sec: layer.start_sec ?? 0,
      description: normalizeText(layer.description),
      duration_sec: layer.duration_sec ?? 8,
      looping: layer.looping ?? false,
      volume: layer.volume ?? 0.3,
    })),
    music: {
      description: normalizeText(raw.music?.description, fallbackMusic),
      duration_sec: raw.music?.duration_sec ?? 50,
      volume: raw.music?.volume ?? 0.4,
      transition: normalizeText(raw.music?.transition, "crossfade_from_previous_4s"),
    },
    state_updates: raw.state_updates ?? [],
    choices: normalizedChoices,
  } satisfies AudioScript;
}

export async function generateStorySegment(
  settings: EchoSettings,
  input: SegmentGenerationInput,
) {
  const chapterPlan = getCurrentChapterPlan(input.story, input);
  const { recentSegments, recentDecisions } = summarizeHistory(
    input.previousSegments,
    input.previousDecisions,
  );
  const worldSummary = summarizeWorldState(input.story.worldState);
  const retrievalSummary = summarizeRetrievalContext(input.retrievalContext);
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
- Treat selected_action as the player's canonical decision for this turn.
- If selected_action.source is free_text, honor the exact intent of that custom action instead of collapsing it into a nearby canned choice.
- Each segment should feel like 35-90 seconds of narration.
- Keep the JSON compact.
- narration.text should usually stay within 110-180 words.
- narration.text is the user-facing prose shown on screen. Keep it natural and immersive. Do not add artificial speaker labels just to help voice switching.
- narration.voice_cues is a separate playback script in chronological order. Use it to mark narration vs dialogue, and attach the exact speaker name for dialogue when possible.
- narration.voice_cues should preserve the same spoken scene as narration.text, but it can split that scene into smaller narration and dialogue pieces for TTS.
- Always include a non-empty music object. Every segment needs pure instrumental background music that matches the scene.
- Use at most 2 sfx layers unless a third layer is essential.
- Use music.description for the continuous background bed or ambient score.
- Use sfx_layers only for distinct non-verbal sound events, not ongoing background music.
- If the scene opens with a concrete cue such as a doorbell, knock, slam, alarm, phone buzz, or impact, place that one-shot moment in sfx_layers near the start so it is heard clearly.
- After any opening cue, let music.description carry the middle and end of the segment with evolving ambience instead of repeating the same one-shot event for the full duration.
- Design music.description as a scene arc, not a static loop: reflect how the room, tension, or environment should feel across the opening, middle, and ending beats of the narration.
- Use the world's sonic_dna signature sound and music_style as guidance for texture, but only foreground the signature sound when it matches the current beat.
- Never describe speech, narration, dialogue, lyrics, or any spoken words inside music.description or sfx_layers[].description.
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
    "voice_style": "string",
    "voice_cues": [{
      "kind": "narration|dialogue",
      "text": "string",
      "speaker": "string|null"
    }]
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
    selected_action: input.selectedAction
      ? {
          choice_id: input.selectedAction.choiceId,
          choice_text: compactText(input.selectedAction.choiceText, 120),
          source: input.selectedAction.isFreeText ? "free_text" : "generated_choice",
        }
      : null,
    latest_action: compactText(latestAction, 120),
    premise: compactText(input.story.premise, 220),
    current_chapter_plan: {
      ...chapterPlan,
      summary: compactText(chapterPlan.summary, 120),
    },
    player_profile: input.playerProfile,
    recent_history: { recentSegments, recentDecisions },
    retrieved_memory: retrievalSummary,
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
    previousDecisions: input.previousDecisions,
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
