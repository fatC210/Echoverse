import { describe, expect, it } from "vitest";
import { ELEVENLABS_VOICES } from "@/lib/constants/defaults";
import { planNarrationCues } from "./narration-voices";

describe("planNarrationCues", () => {
  const femaleVoiceIds = ELEVENLABS_VOICES.filter((voice) => voice.gender === "female").map(
    (voice) => voice.id,
  );

  it("prefers structured playback cues so narration text can stay natural", () => {
    const narratorVoiceId = "nPczCjzI2devNBz1zQrb";

    const cues = planNarrationCues({
      text: "她的提醒让空气都冷了下来。",
      narratorVoiceId,
      protagonistName: "林薇",
      characters: [
        {
          id: "aria",
          name: "ARIA",
          role: "station AI",
          personality: "precise and restrained",
          relationship_to_protagonist: "system partner",
          voice_description: "synthetic, calm, precise",
        },
      ],
      scriptedCues: [
        {
          kind: "narration",
          text: "她的提醒让空气都冷了下来。",
          speaker: null,
        },
        {
          kind: "dialogue",
          text: "立即停止访问受限档案。",
          speaker: "ARIA",
        },
      ],
    });

    expect(cues).toEqual([
      {
        kind: "narration",
        text: "她的提醒让空气都冷了下来。",
        voiceId: narratorVoiceId,
      },
      {
        kind: "dialogue",
        text: "立即停止访问受限档案。",
        speaker: "ARIA",
        voiceId: expect.not.stringMatching(/^nPczCjzI2devNBz1zQrb$/),
      },
    ]);
  });

  it("keeps narration on the configured narrator voice while switching dialogue to an auto-assigned character voice", () => {
    const narratorVoiceId = "nPczCjzI2devNBz1zQrb";

    const cues = planNarrationCues({
      text: '控制台上的日志突然停止滚动。ARIA的声音突然插入：“立即停止访问受限档案。” 她的警告让空气都冷了下来。',
      narratorVoiceId,
      protagonistName: "林薇",
      characters: [
        {
          id: "aria",
          name: "ARIA",
          role: "station AI",
          personality: "precise and restrained",
          relationship_to_protagonist: "system partner",
          voice_description: "synthetic, calm, precise",
        },
      ],
    });

    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject({
      kind: "narration",
      voiceId: narratorVoiceId,
    });
    expect(cues[1]).toMatchObject({
      kind: "dialogue",
      speaker: "ARIA",
    });
    expect(cues[1]?.voiceId).not.toBe(narratorVoiceId);
    expect(cues[2]).toMatchObject({
      kind: "narration",
      voiceId: narratorVoiceId,
    });
  });

  it("reuses the same auto-assigned voice when one speaker has consecutive quoted lines", () => {
    const narratorVoiceId = "pFZP5JQG7iQjIQuC4Bku";

    const cues = planNarrationCues({
      text: 'ARIA说：“先别出声。” “听通风井。” 远处果然传来一阵金属轻响。',
      narratorVoiceId,
      protagonistName: "林薇",
      characters: [
        {
          id: "aria",
          name: "ARIA",
          role: "ship AI",
          personality: "measured and analytical",
          relationship_to_protagonist: "mission control",
          voice_description: "synthetic, low, precise",
        },
      ],
    });

    const dialogueCues = cues.filter((cue) => cue.kind === "dialogue");

    expect(dialogueCues).toHaveLength(1);
    expect(dialogueCues[0]?.speaker).toBe("ARIA");
    expect(dialogueCues[0]?.voiceId).not.toBe(narratorVoiceId);
    expect(dialogueCues[0]?.text).toContain("先别出声。");
    expect(dialogueCues[0]?.text).toContain("听通风井。");
  });

  it("keeps the protagonist on the narrator voice when they speak", () => {
    const narratorVoiceId = "EXAVITQu4vr4xnSDxMaL";

    const cues = planNarrationCues({
      text: 'Mira whispered, "Keep the beacon alive," before she touched the relay core.',
      narratorVoiceId,
      protagonistName: "Mira",
      characters: [],
    });

    const dialogueCue = cues.find((cue) => cue.kind === "dialogue");

    expect(dialogueCue).toMatchObject({
      speaker: "Mira",
      voiceId: narratorVoiceId,
    });
  });

  it("anchors structured dialogue cues to the prose order and fills missing narration around them", () => {
    const narratorVoiceId = "nPczCjzI2devNBz1zQrb";

    const cues = planNarrationCues({
      text: 'The log stops scrolling. ARIA cuts in: "Access is restricted." Cold air settles over the room.',
      narratorVoiceId,
      protagonistName: "Mira",
      characters: [
        {
          id: "aria",
          name: "ARIA",
          role: "station AI",
          personality: "precise and restrained",
          relationship_to_protagonist: "system partner",
          voice_description: "synthetic, calm, precise",
        },
      ],
      scriptedCues: [
        {
          kind: "dialogue",
          text: "Access is restricted.",
          speaker: "ARIA",
        },
      ],
    });

    expect(cues).toHaveLength(3);
    expect(cues[0]).toEqual({
      kind: "narration",
      text: "The log stops scrolling. ARIA cuts in:",
      voiceId: narratorVoiceId,
    });
    expect(cues[1]).toMatchObject({
      kind: "dialogue",
      text: "Access is restricted.",
      speaker: "ARIA",
    });
    expect(cues[1]?.voiceId).not.toBe(narratorVoiceId);
    expect(cues[2]).toEqual({
      kind: "narration",
      text: "Cold air settles over the room.",
      voiceId: narratorVoiceId,
    });
  });

  it("switches anonymous dialogue to a female voice when nearby prose marks the speaker as a woman", () => {
    const narratorVoiceId = "nPczCjzI2devNBz1zQrb";

    const cues = planNarrationCues({
      text: '一个穿黑色风衣的女人从阴影里走出来。“你也发现了。” 她的声音平静得像在陈述天气。',
      narratorVoiceId,
      protagonistName: "林默",
      characters: [],
    });

    const dialogueCue = cues.find((cue) => cue.kind === "dialogue");

    expect(dialogueCue).toBeDefined();
    expect(dialogueCue?.speaker).toBeUndefined();
    expect(dialogueCue?.voiceId).not.toBe(narratorVoiceId);
    expect(femaleVoiceIds).toContain(dialogueCue?.voiceId);
  });

  it("uses female context hints for structured dialogue cues even when the cue omits a speaker name", () => {
    const narratorVoiceId = "nPczCjzI2devNBz1zQrb";

    const cues = planNarrationCues({
      text: '一个穿黑色风衣的女人从阴影里走出来，手里攥着追踪器。“你也发现了。” 她的声音平静得像在陈述天气。',
      narratorVoiceId,
      protagonistName: "林默",
      characters: [],
      scriptedCues: [
        {
          kind: "dialogue",
          text: "你也发现了。",
          speaker: null,
        },
      ],
    });

    const dialogueCue = cues.find((cue) => cue.kind === "dialogue");

    expect(dialogueCue).toBeDefined();
    expect(dialogueCue?.speaker).toBeUndefined();
    expect(dialogueCue?.voiceId).not.toBe(narratorVoiceId);
    expect(femaleVoiceIds).toContain(dialogueCue?.voiceId);
  });
});
