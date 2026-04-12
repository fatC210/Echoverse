import { generateStructuredJson } from "@/lib/services/llm";
import type { EchoSettings } from "@/lib/constants/defaults";
import type { Story, StoryDurationId, WorldGenerationInput, WorldState } from "@/lib/types/echoverse";
import { createId } from "@/lib/utils/echoverse";

const DURATION_TO_CHAPTERS: Record<StoryDurationId, number> = {
  short: 3,
  medium: 5,
  long: 8,
};

function normalizeWorldState(
  world: Partial<WorldState>,
  storyLanguage: WorldGenerationInput["storyLanguage"],
  targetChoiceCount: number,
) {
  return {
    title: world.title ?? "Untitled Echo",
    genre: world.genre ?? "Interactive Fiction",
    tone: world.tone ?? "immersive",
    setting: {
      location: world.setting?.location ?? "Unknown world",
      era: world.setting?.era ?? "Undefined era",
      atmosphere: world.setting?.atmosphere ?? "",
    },
    protagonist: {
      name: world.protagonist?.name ?? "The Listener",
      role: world.protagonist?.role ?? "Wanderer",
      personality: world.protagonist?.personality ?? "",
      motivation: world.protagonist?.motivation ?? "",
      wound: world.protagonist?.wound ?? "",
    },
    characters: world.characters ?? [],
    locations: world.locations ?? [],
    items: world.items ?? [],
    sonic_dna: {
      palette: world.sonic_dna?.palette ?? [],
      music_style: world.sonic_dna?.music_style ?? "",
      avoid: world.sonic_dna?.avoid ?? [],
      signature_sound: world.sonic_dna?.signature_sound ?? "",
    },
    chapters: world.chapters ?? [],
    story_rules: {
      story_language: world.story_rules?.story_language ?? storyLanguage,
      total_target_choices: world.story_rules?.total_target_choices ?? targetChoiceCount,
    },
    notes: world.notes ?? [],
  } satisfies WorldState;
}

export async function generateWorldState(
  settings: EchoSettings,
  input: WorldGenerationInput,
) {
  const allTags = [...input.selectedPresetTags, ...input.selectedCustomTags];
  const chapterCount = DURATION_TO_CHAPTERS[input.duration];
  const systemPrompt = `You are Echoverse's world building engine.
Given a story premise, selected tags and a target duration, return a single valid JSON object only.

Requirements:
- Build an internally coherent story world for interactive audio storytelling.
- The user's premise has priority. Tags should guide mood, texture and story hooks.
- Incorporate both preset tags and custom tags organically.
- Keep the output compact and concise.
- Generate 3-5 locations, 2-4 characters, 4-6 key items.
- Define sonic DNA for sound effect and music generation.
- Plan ${chapterCount} chapters.
- Use short ids in snake_case.
- Keep each description, summary and personality field to one sentence.
- Keep string values brief unless a longer sentence is necessary for clarity.
- story_rules.story_language must be "${input.storyLanguage}".

JSON shape:
{
  "title": "string",
  "genre": "string",
  "tone": "string",
  "setting": {
    "location": "string",
    "era": "string",
    "atmosphere": "string"
  },
  "protagonist": {
    "name": "string",
    "role": "string",
    "personality": "string",
    "motivation": "string",
    "wound": "string"
  },
  "characters": [{
    "id": "string",
    "name": "string",
    "role": "string",
    "personality": "string",
    "relationship_to_protagonist": "string",
    "voice_description": "string"
  }],
  "locations": [{
    "id": "string",
    "name": "string",
    "description": "string",
    "atmosphere": "string",
    "connected_to": ["string"],
    "sfx_hints": "string",
    "discoverable_items": ["string"]
  }],
  "items": [{
    "id": "string",
    "name": "string",
    "description": "string",
    "narrative_function": "string",
    "discoverable": true
  }],
  "sonic_dna": {
    "palette": ["string"],
    "music_style": "string",
    "avoid": ["string"],
    "signature_sound": "string"
  },
  "chapters": [{
    "id": "string",
    "title": "string",
    "summary": "string",
    "target_mood": "string",
    "target_choices": 1
  }],
  "story_rules": {
    "story_language": "${input.storyLanguage}",
    "total_target_choices": ${chapterCount}
  }
}`;

  const userPrompt = `Premise:
${input.premise}

Selected tags:
${allTags.length ? allTags.join(", ") : "No tags selected"}

Target duration:
${input.duration} (${chapterCount} chapters)

Return valid JSON only.`;

  const world = await generateStructuredJson<WorldState>(
    settings.llm,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.6,
      max_tokens: 2600,
    },
  );

  return normalizeWorldState(world, input.storyLanguage, chapterCount);
}

export function createStoryRecord(
  input: WorldGenerationInput,
  worldState: WorldState,
) {
  const now = new Date().toISOString();

  return {
    id: createId("story"),
    title: worldState.title,
    genre: worldState.genre,
    tags: {
      preset: input.selectedPresetTags,
      custom: input.selectedCustomTags,
    },
    premise: input.premise,
    worldState,
    status: "playing",
    currentChapter: worldState.chapters[0]?.id ?? "chapter_1",
    currentSegmentIndex: 0,
    continuedAfterEnding: false,
    createdAt: now,
    updatedAt: now,
    totalDurationSec: 0,
    totalDecisions: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
  } satisfies Story;
}
