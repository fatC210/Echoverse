import type { AudioAsset, Segment } from "@/lib/types/echoverse";

export interface MixerVolumes {
  master: number;
  narration: number;
  sfx: number;
  music: number;
}

class AudioMixer {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private narrationGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private currentMusicSource: AudioBufferSourceNode | null = null;
  private activeSources = new Set<AudioBufferSourceNode>();
  private currentMusicMixFactor = 1;
  private volumes: MixerVolumes = {
    master: 1,
    narration: 1,
    sfx: 0.7,
    music: 0.4,
  };

  private async ensureContext() {
    if (typeof window === "undefined") {
      return null;
    }

    if (!this.context) {
      const context = new AudioContext();
      const masterGain = context.createGain();
      const narrationGain = context.createGain();
      const sfxGain = context.createGain();
      const musicGain = context.createGain();

      narrationGain.connect(masterGain);
      sfxGain.connect(masterGain);
      musicGain.connect(masterGain);
      masterGain.connect(context.destination);

      this.context = context;
      this.masterGain = masterGain;
      this.narrationGain = narrationGain;
      this.sfxGain = sfxGain;
      this.musicGain = musicGain;
      this.applyVolumes();
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    return this.context;
  }

  private applyVolumes() {
    if (!this.masterGain || !this.narrationGain || !this.sfxGain || !this.musicGain) {
      return;
    }

    this.masterGain.gain.value = this.volumes.master;
    this.narrationGain.gain.value = this.volumes.narration;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.musicGain.gain.value = this.clampVolume(this.volumes.music * this.currentMusicMixFactor);
  }

  private clampVolume(value: number) {
    return Math.min(Math.max(value, 0), 1);
  }

  private getSegmentMusicMixFactor(segment: Segment) {
    const authoredMusicVolume = segment.audioScript.music?.volume ?? 0.4;
    return authoredMusicVolume / 0.4;
  }

  private getSegmentMusicVolume(segment: Segment) {
    return this.clampVolume(this.volumes.music * this.getSegmentMusicMixFactor(segment));
  }

  private async decodeAudio(blob: Blob) {
    const context = await this.ensureContext();

    if (!context) {
      throw new Error("AudioContext is unavailable");
    }

    const arrayBuffer = await blob.arrayBuffer();
    return context.decodeAudioData(arrayBuffer.slice(0));
  }

  setVolumes(volumes: MixerVolumes) {
    this.volumes = volumes;
    this.applyVolumes();
  }

  async pause() {
    if (this.context?.state === "running") {
      await this.context.suspend();
    }
  }

  async resume() {
    if (!this.context) {
      await this.ensureContext();
      return;
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  stopAll() {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Ignore stopped sources.
      }
    }

    this.activeSources.clear();
    this.currentMusicSource = null;
    this.currentMusicMixFactor = 1;
  }

  async playSegment(segment: Segment, assets: Record<string, AudioAsset>) {
    const context = await this.ensureContext();

    if (!context || !segment.resolvedAudio) {
      return {
        narrationDurationSec: 0,
        completion: Promise.resolve(),
      };
    }

    const hasOpeningCue = segment.audioScript.sfx_layers.some(
      (layer) => !layer.looping && layer.start_sec <= 0.2,
    );
    const startAt = context.currentTime + 0.05;
    const narrationStartAt = startAt + (hasOpeningCue ? 0.45 : 0);
    const narrationCueAssets =
      segment.resolvedAudio.narrationCues?.length
        ? segment.resolvedAudio.narrationCues
            .map((cue) => ({
              cue,
              asset: assets[cue.assetId],
            }))
            .filter((item) => Boolean(item.asset))
        : [];
    const narrationAsset =
      narrationCueAssets.length === 0 && segment.resolvedAudio.narrationAssetId
        ? assets[segment.resolvedAudio.narrationAssetId]
        : undefined;

    let narrationDurationSec = narrationCueAssets.reduce(
      (totalDuration, item) => totalDuration + (item.asset?.durationSec ?? 0),
      0,
    );
    if (!narrationDurationSec) {
      narrationDurationSec = narrationAsset?.durationSec ?? 0;
    }
    let narrationPromise = Promise.resolve();

    if (segment.resolvedAudio.musicAssetId) {
      const musicAsset = assets[segment.resolvedAudio.musicAssetId];

      if (musicAsset && this.musicGain) {
        this.currentMusicMixFactor = this.getSegmentMusicMixFactor(segment);
        const targetMusicVolume = this.getSegmentMusicVolume(segment);
        const buffer = await this.decodeAudio(musicAsset.audioBlob);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = false;
        source.connect(this.musicGain);

        if (this.currentMusicSource && this.musicGain) {
          const currentMusicVolume = this.musicGain.gain.value;
          this.musicGain.gain.cancelScheduledValues(context.currentTime);
          this.musicGain.gain.setValueAtTime(currentMusicVolume, context.currentTime);
          this.musicGain.gain.linearRampToValueAtTime(0, context.currentTime + 4);

          try {
            this.currentMusicSource.stop(context.currentTime + 4);
          } catch {
            // Ignore stopped source.
          }
        }

        this.musicGain.gain.setValueAtTime(0, startAt);
        this.musicGain.gain.linearRampToValueAtTime(targetMusicVolume, startAt + 2);
        source.start(startAt);
        this.currentMusicSource = source;
        this.activeSources.add(source);
        source.onended = () => {
          this.activeSources.delete(source);
          if (this.currentMusicSource === source) {
            this.currentMusicSource = null;
          }
        };
      }
    }

    for (let index = 0; index < segment.audioScript.sfx_layers.length; index += 1) {
      const assetId = segment.resolvedAudio.sfxAssetIds[index];
      const layer = segment.audioScript.sfx_layers[index];
      const asset = assetId ? assets[assetId] : undefined;

      if (!asset || !this.sfxGain) {
        continue;
      }

      const buffer = await this.decodeAudio(asset.audioBlob);
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = layer.looping;
      gain.gain.value = Math.min(
        layer.volume * (!layer.looping && layer.start_sec <= 0.5 ? 1.2 : 1),
        1,
      );
      source.connect(gain);
      gain.connect(this.sfxGain);
      source.start(startAt + layer.start_sec);

      const stopAt = narrationStartAt + Math.max(narrationDurationSec, layer.duration_sec) + 1;
      source.stop(stopAt);
      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
      };
    }

    if ((narrationCueAssets.length || narrationAsset) && this.narrationGain) {
      const scheduledNarration =
        narrationCueAssets.length > 0
          ? await Promise.all(
              narrationCueAssets.map(async ({ asset }) => ({
                buffer: await this.decodeAudio(asset.audioBlob),
              })),
            )
          : narrationAsset
            ? [
                {
                  buffer: await this.decodeAudio(narrationAsset.audioBlob),
                },
              ]
            : [];

      narrationDurationSec = scheduledNarration.reduce(
        (totalDuration, item) => totalDuration + item.buffer.duration,
        0,
      );

      if (this.musicGain) {
        const currentMusicVolume = this.getSegmentMusicVolume(segment);
        this.musicGain.gain.cancelScheduledValues(narrationStartAt);
        this.musicGain.gain.setValueAtTime(currentMusicVolume, narrationStartAt);
        this.musicGain.gain.linearRampToValueAtTime(
          currentMusicVolume * 0.4,
          narrationStartAt + 0.4,
        );
        this.musicGain.gain.linearRampToValueAtTime(
          currentMusicVolume,
          narrationStartAt + narrationDurationSec + 0.6,
        );
      }

      narrationPromise = new Promise<void>((resolve) => {
        if (!scheduledNarration.length) {
          resolve();
          return;
        }

        let cueStartAt = narrationStartAt;

        scheduledNarration.forEach((item, index) => {
          const source = context.createBufferSource();
          source.buffer = item.buffer;
          source.connect(this.narrationGain);
          source.start(cueStartAt);
          this.activeSources.add(source);

          source.onended = () => {
            this.activeSources.delete(source);
            if (index === scheduledNarration.length - 1) {
              resolve();
            }
          };

          cueStartAt += item.buffer.duration;
        });
      });
    }

    return {
      narrationDurationSec,
      completion: narrationPromise,
    };
  }
}

let mixer: AudioMixer | null = null;

export function getAudioMixer() {
  if (!mixer) {
    mixer = new AudioMixer();
  }

  return mixer;
}
