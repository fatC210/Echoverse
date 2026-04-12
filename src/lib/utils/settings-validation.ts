import { resolveLlmSettings, type EchoSettings } from "@/lib/constants/defaults";
import { isElevenLabsVerified } from "@/lib/services/elevenlabs";

type LlmSettings = EchoSettings["llm"];
type ElevenLabsSettings = EchoSettings["elevenlabs"];
type TurbopufferSettings = EchoSettings["turbopuffer"];
type VoiceSettings = EchoSettings["voice"];

export function serializeLlmVerification(llm: LlmSettings) {
  const resolved = resolveLlmSettings(llm);

  return [
    resolved.baseUrl.trim(),
    llm.apiKey.trim(),
    resolved.model.trim(),
    resolved.embeddingModel.trim(),
  ].join("|");
}

export function isLlmComplete(llm: LlmSettings) {
  const resolved = resolveLlmSettings(llm);

  return Boolean(
    resolved.baseUrl.trim() &&
      llm.apiKey.trim() &&
      resolved.model.trim() &&
      resolved.embeddingModel.trim(),
  );
}

export function isLlmVerified(llm: LlmSettings) {
  const verifiedSignature = llm.verifiedConfigSignature.trim();

  return Boolean(
    isLlmComplete(llm) &&
      verifiedSignature &&
      verifiedSignature === serializeLlmVerification(llm),
  );
}

export function serializeTurbopufferVerification(turbopuffer: TurbopufferSettings) {
  return [turbopuffer.baseUrl.trim(), turbopuffer.apiKey.trim()].join("|");
}

export function isTurbopufferComplete(turbopuffer: TurbopufferSettings) {
  return Boolean(turbopuffer.baseUrl.trim() && turbopuffer.apiKey.trim());
}

export function isTurbopufferVerified(turbopuffer: TurbopufferSettings) {
  const verifiedSignature = turbopuffer.verifiedConfigSignature.trim();

  return Boolean(
    isTurbopufferComplete(turbopuffer) &&
      verifiedSignature &&
      verifiedSignature === serializeTurbopufferVerification(turbopuffer),
  );
}

interface ServiceSettingsSubset {
  llm: LlmSettings;
  elevenlabs: ElevenLabsSettings;
  turbopuffer: TurbopufferSettings;
}

interface RequiredSettingsSubset extends ServiceSettingsSubset {
  voice: VoiceSettings;
}

export function hasValidatedServiceConfiguration(settings: ServiceSettingsSubset) {
  return Boolean(
    isLlmVerified(settings.llm) &&
      isElevenLabsVerified(settings.elevenlabs) &&
      isTurbopufferVerified(settings.turbopuffer),
  );
}

export function hasRequiredConfiguration(settings: RequiredSettingsSubset) {
  return Boolean(
    hasValidatedServiceConfiguration(settings) &&
      settings.voice.voiceId.trim(),
  );
}
