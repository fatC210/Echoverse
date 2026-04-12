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
    this.musicGain.gain.value = this.volumes.music;
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
  }

  async playSegment(segment: Segment, assets: Record<string, AudioAsset>) {
    const context = await this.ensureContext();

    if (!context || !segment.resolvedAudio) {
      return {
        narrationDurationSec: 0,
        completion: Promise.resolve(),
      };
    }

    const startAt = context.currentTime + 0.05;
    const narrationAsset = segment.resolvedAudio.narrationAssetId
      ? assets[segment.resolvedAudio.narrationAssetId]
      : undefined;

    let narrationDurationSec = narrationAsset?.durationSec ?? 0;
    let narrationPromise = Promise.resolve();

    if (segment.resolvedAudio.musicAssetId) {
      const musicAsset = assets[segment.resolvedAudio.musicAssetId];

      if (musicAsset && this.musicGain) {
        const buffer = await this.decodeAudio(musicAsset.audioBlob);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = false;
        source.connect(this.musicGain);

        if (this.currentMusicSource && this.musicGain) {
          this.musicGain.gain.cancelScheduledValues(context.currentTime);
          this.musicGain.gain.setValueAtTime(this.volumes.music, context.currentTime);
          this.musicGain.gain.linearRampToValueAtTime(0, context.currentTime + 4);

          try {
            this.currentMusicSource.stop(context.currentTime + 4);
          } catch {
            // Ignore stopped source.
          }
        }

        this.musicGain.gain.setValueAtTime(0, startAt);
        this.musicGain.gain.linearRampToValueAtTime(this.volumes.music, startAt + 2);
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
      gain.gain.value = layer.volume;
      source.connect(gain);
      gain.connect(this.sfxGain);
      source.start(startAt + layer.start_sec);

      const stopAt = startAt + Math.max(narrationDurationSec, layer.duration_sec) + 1;
      source.stop(stopAt);
      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
      };
    }

    if (narrationAsset && this.narrationGain) {
      const buffer = await this.decodeAudio(narrationAsset.audioBlob);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.narrationGain);
      narrationDurationSec = buffer.duration;

      if (this.musicGain) {
        const currentMusicVolume = this.volumes.music;
        this.musicGain.gain.cancelScheduledValues(startAt);
        this.musicGain.gain.setValueAtTime(currentMusicVolume, startAt);
        this.musicGain.gain.linearRampToValueAtTime(currentMusicVolume * 0.4, startAt + 0.4);
        this.musicGain.gain.linearRampToValueAtTime(
          currentMusicVolume,
          startAt + narrationDurationSec + 0.6,
        );
      }

      narrationPromise = new Promise<void>((resolve) => {
        source.onended = () => {
          this.activeSources.delete(source);
          resolve();
        };
      });

      source.start(startAt);
      this.activeSources.add(source);
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
