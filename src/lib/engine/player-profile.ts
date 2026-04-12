import type { Decision, PlayerProfile } from "@/lib/types/echoverse";

export function createEmptyPlayerProfile(storyId: string) {
  return {
    id: "current",
    storyId,
    brave: 0,
    cautious: 0,
    empathetic: 0,
    analytical: 0,
    avgDecisionTimeMs: 0,
    preferredPacing: "moderate",
    scareTolerance: "medium",
    totalDecisions: 0,
    updatedAt: new Date().toISOString(),
  } satisfies PlayerProfile;
}

function inferTraitSignal(choiceText: string, riskLevel: Decision["riskLevel"]) {
  const normalized = choiceText.toLowerCase();

  if (riskLevel === "high") {
    return "brave";
  }

  if (riskLevel === "low") {
    return "cautious";
  }

  if (/(help|comfort|save|protect|listen|forgive)/.test(normalized)) {
    return "empathetic";
  }

  if (/(analyze|observe|inspect|study|investigate|record)/.test(normalized)) {
    return "analytical";
  }

  return "balanced";
}

export function buildDecisionRecord(input: {
  storyId: string;
  segmentId: string;
  chapterId: string;
  choiceId: string;
  choiceText: string;
  riskLevel: Decision["riskLevel"];
  timeToDecideMs: number;
}) {
  return {
    id: crypto.randomUUID(),
    storyId: input.storyId,
    segmentId: input.segmentId,
    chapterId: input.chapterId,
    choiceId: input.choiceId,
    choiceText: input.choiceText,
    riskLevel: input.riskLevel,
    traitSignal: inferTraitSignal(input.choiceText, input.riskLevel),
    timeToDecideMs: input.timeToDecideMs,
    timestamp: new Date().toISOString(),
  } satisfies Decision;
}

export function updatePlayerProfile(profile: PlayerProfile, decision: Decision) {
  const next = {
    ...profile,
    updatedAt: new Date().toISOString(),
    totalDecisions: profile.totalDecisions + 1,
    avgDecisionTimeMs:
      profile.totalDecisions === 0
        ? decision.timeToDecideMs
        : Math.round(
            (profile.avgDecisionTimeMs * profile.totalDecisions + decision.timeToDecideMs) /
              (profile.totalDecisions + 1),
          ),
  };

  if (decision.riskLevel === "high") {
    next.brave += 1;
  }

  if (decision.riskLevel === "low") {
    next.cautious += 1;
  }

  if (decision.traitSignal === "empathetic") {
    next.empathetic += 1;
  }

  if (decision.traitSignal === "analytical") {
    next.analytical += 1;
  }

  next.preferredPacing =
    next.avgDecisionTimeMs < 12_000
      ? "fast"
      : next.avgDecisionTimeMs > 35_000
        ? "slow"
        : "moderate";

  const braveRatio = next.totalDecisions ? next.brave / next.totalDecisions : 0;
  next.scareTolerance = braveRatio > 0.45 ? "high" : braveRatio < 0.2 ? "low" : "medium";

  return next;
}
