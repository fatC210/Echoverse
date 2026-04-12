export type Language = "en" | "zh";

export type StoryDurationId = "short" | "medium" | "long";

export type MoodColor =
  | "dread"
  | "wonder"
  | "tension"
  | "peace"
  | "horror"
  | "adventure"
  | "joy"
  | "melancholy"
  | "mystery";

export interface WorldCharacter {
  id: string;
  name: string;
  role: string;
  personality: string;
  relationship_to_protagonist: string;
  voice_description: string;
}

export interface WorldLocation {
  id: string;
  name: string;
  description: string;
  atmosphere: string;
  connected_to: string[];
  sfx_hints: string;
  discoverable_items: string[];
}

export interface WorldItem {
  id: string;
  name: string;
  description: string;
  narrative_function: string;
  discoverable: boolean;
}

export interface StoryChapterPlan {
  id: string;
  title: string;
  summary: string;
  target_mood: string;
  target_choices: number;
}

export interface WorldState {
  title: string;
  genre: string;
  tone: string;
  setting: {
    location: string;
    era: string;
    atmosphere: string;
  };
  protagonist: {
    name: string;
    role: string;
    personality: string;
    motivation: string;
    wound: string;
  };
  characters: WorldCharacter[];
  locations: WorldLocation[];
  items: WorldItem[];
  sonic_dna: {
    palette: string[];
    music_style: string;
    avoid: string[];
    signature_sound: string;
  };
  chapters: StoryChapterPlan[];
  story_rules: {
    story_language: Language;
    total_target_choices: number;
  };
  notes?: string[];
}

export interface AudioChoice {
  id: string;
  text: string;
  hint: string;
  risk: "low" | "medium" | "high";
  unlocks: string;
}

export interface AudioLayerScript {
  id: string;
  start_sec: number;
  description: string;
  duration_sec: number;
  looping: boolean;
  volume: number;
}

export interface MusicScript {
  description: string;
  duration_sec: number;
  volume: number;
  transition: string;
}

export interface AudioScript {
  segment_id: string;
  chapter: string;
  chapter_title: string;
  mood_color: MoodColor;
  emotion_arc: string;
  is_ending: boolean;
  ending_name: string | null;
  narration: {
    text: string;
    voice_style: string;
  };
  sfx_layers: AudioLayerScript[];
  music: MusicScript | null;
  state_updates: Array<{
    entity_id: string;
    updates: Record<string, unknown>;
  }>;
  choices: AudioChoice[];
}

export interface Story {
  id: string;
  title: string;
  genre: string;
  tags: {
    preset: string[];
    custom: string[];
  };
  premise: string;
  worldState: WorldState;
  status: "playing" | "completed";
  currentChapter: string;
  currentSegmentIndex: number;
  endingName?: string;
  continuedAfterEnding: boolean;
  createdAt: string;
  updatedAt: string;
  totalDurationSec: number;
  totalDecisions: number;
  cacheHitCount: number;
  cacheMissCount: number;
}

export interface SegmentChoiceMade {
  choiceId: string;
  choiceText: string;
  isFreeText: boolean;
  timestamp: string;
  timeToDecideMs: number;
}

export interface SegmentAudioStatus {
  tts: "pending" | "ready" | "failed";
  sfx: Array<"pending" | "ready" | "failed">;
  music: "pending" | "ready" | "failed";
}

export interface SegmentAudioRefs {
  narrationAssetId?: string;
  sfxAssetIds: string[];
  musicAssetId?: string;
}

export interface Segment {
  id: string;
  storyId: string;
  chapterId: string;
  audioScript: AudioScript;
  choiceMade?: SegmentChoiceMade;
  audioStatus: SegmentAudioStatus;
  resolvedAudio?: SegmentAudioRefs;
  createdAt: string;
}

export interface AudioAsset {
  id: string;
  storyId: string;
  category: "sfx" | "music" | "tts";
  description: string;
  audioBlob: Blob;
  durationSec: number;
  looping: boolean;
  mood: string;
  createdAt: string;
  timesUsed: number;
  embedding?: number[];
  contentType?: string;
}

export interface Decision {
  id: string;
  storyId: string;
  segmentId: string;
  chapterId: string;
  choiceId: string;
  choiceText: string;
  riskLevel: "low" | "medium" | "high";
  traitSignal: string;
  timeToDecideMs: number;
  timestamp: string;
}

export interface PlayerProfile {
  id: "current";
  storyId: string;
  brave: number;
  cautious: number;
  empathetic: number;
  analytical: number;
  avgDecisionTimeMs: number;
  preferredPacing: "fast" | "moderate" | "slow";
  scareTolerance: "low" | "medium" | "high";
  totalDecisions: number;
  updatedAt: string;
}

export interface CustomTag {
  id: string;
  text: string;
  createdAt: string;
  usageCount: number;
}

export interface VoiceOption {
  voice_id: string;
  name: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
  category?: string;
  voice_type?: string;
}

export interface WorldGenerationInput {
  premise: string;
  selectedPresetTags: string[];
  selectedCustomTags: string[];
  storyLanguage: Language;
  duration: StoryDurationId;
}

export interface SegmentGenerationInput {
  story: Story;
  previousSegments: Segment[];
  previousDecisions: Decision[];
  playerProfile: PlayerProfile;
  selectedAction?: {
    choiceId: string;
    choiceText: string;
    isFreeText: boolean;
  } | null;
  mode?: "normal" | "end_story" | "continue_after_ending";
}
