import type { AudioAsset, Segment, Story } from "@/lib/types/echoverse";
import { downloadBlob } from "@/lib/utils/echoverse";

function buildSegmentLabel(segment: Segment) {
  return `${segment.audioScript.chapter_title} (${segment.audioScript.mood_color})`;
}

export function buildStoryMarkdown(story: Story, segments: Segment[]) {
  const lines = [
    `# ${story.title}`,
    "",
    `- Genre: ${story.genre}`,
    `- Premise: ${story.premise}`,
    `- Status: ${story.status}`,
    "",
  ];

  for (const segment of segments) {
    lines.push(`## ${buildSegmentLabel(segment)}`);
    lines.push("");
    lines.push(segment.audioScript.narration.text);
    lines.push("");

    if (segment.choiceMade) {
      lines.push(`- Choice: ${segment.choiceMade.choiceText}`);
      lines.push(`- Timestamp: ${segment.choiceMade.timestamp}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function exportStoryMarkdown(story: Story, segments: Segment[]) {
  const blob = new Blob([buildStoryMarkdown(story, segments)], {
    type: "text/markdown;charset=utf-8",
  });
  downloadBlob(blob, `${story.title.replace(/[^\w-]+/g, "_")}.md`);
}

export function exportWorldJson(story: Story) {
  const blob = new Blob([JSON.stringify(story.worldState, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  downloadBlob(blob, `${story.title.replace(/[^\w-]+/g, "_")}.json`);
}

async function decodeWithContext(context: AudioContext, blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer();
  return context.decodeAudioData(arrayBuffer.slice(0));
}

async function renderStoryAudio(
  segments: Segment[],
  assets: Record<string, AudioAsset>,
) {
  const decodeContext = new AudioContext();

  try {
    const scheduled: Array<{
      segment: Segment;
      narration?: AudioBuffer;
      music?: AudioBuffer;
      sfx: Array<{ buffer: AudioBuffer; startSec: number; volume: number; looping: boolean; durationSec: number }>;
      durationSec: number;
    }> = [];
    let totalDurationSec = 0;

    for (const segment of segments) {
      const narrationAsset = segment.resolvedAudio?.narrationAssetId
        ? assets[segment.resolvedAudio.narrationAssetId]
        : undefined;
      const musicAsset = segment.resolvedAudio?.musicAssetId
        ? assets[segment.resolvedAudio.musicAssetId]
        : undefined;

      const narration = narrationAsset
        ? await decodeWithContext(decodeContext, narrationAsset.audioBlob)
        : undefined;
      const music = musicAsset ? await decodeWithContext(decodeContext, musicAsset.audioBlob) : undefined;

      const sfx = [] as Array<{
        buffer: AudioBuffer;
        startSec: number;
        volume: number;
        looping: boolean;
        durationSec: number;
      }>;

      for (let index = 0; index < (segment.resolvedAudio?.sfxAssetIds.length ?? 0); index += 1) {
        const assetId = segment.resolvedAudio?.sfxAssetIds[index];
        const asset = assetId ? assets[assetId] : undefined;
        const layer = segment.audioScript.sfx_layers[index];

        if (!asset || !layer) {
          continue;
        }

        const buffer = await decodeWithContext(decodeContext, asset.audioBlob);
        sfx.push({
          buffer,
          startSec: layer.start_sec,
          volume: layer.volume,
          looping: layer.looping,
          durationSec: layer.duration_sec,
        });
      }

      const sfxDuration = sfx.reduce(
        (max, item) => Math.max(max, item.startSec + item.durationSec),
        0,
      );
      const durationSec = Math.max(
        narration?.duration ?? 0,
        music?.duration ?? 0,
        sfxDuration,
        1,
      );

      scheduled.push({
        segment,
        narration,
        music,
        sfx,
        durationSec,
      });
      totalDurationSec += durationSec + 0.6;
    }

    const sampleRate = 44_100;
    const offline = new OfflineAudioContext(2, Math.ceil(totalDurationSec * sampleRate), sampleRate);
    const masterGain = offline.createGain();
    const narrationGain = offline.createGain();
    const sfxGain = offline.createGain();
    const musicGain = offline.createGain();

    masterGain.connect(offline.destination);
    narrationGain.connect(masterGain);
    sfxGain.connect(masterGain);
    musicGain.connect(masterGain);
    narrationGain.gain.value = 1;
    sfxGain.gain.value = 0.7;
    musicGain.gain.value = 0.4;

    let timelineCursor = 0;

    for (const item of scheduled) {
      if (item.music) {
        const source = offline.createBufferSource();
        source.buffer = item.music;
        source.connect(musicGain);
        source.start(timelineCursor);
      }

      for (const layer of item.sfx) {
        const source = offline.createBufferSource();
        const gain = offline.createGain();
        source.buffer = layer.buffer;
        source.loop = layer.looping;
        gain.gain.value = layer.volume;
        source.connect(gain);
        gain.connect(sfxGain);
        source.start(timelineCursor + layer.startSec);
        source.stop(timelineCursor + layer.startSec + layer.durationSec);
      }

      if (item.narration) {
        const source = offline.createBufferSource();
        source.buffer = item.narration;
        source.connect(narrationGain);
        source.start(timelineCursor);
      }

      timelineCursor += item.durationSec + 0.6;
    }

    return offline.startRendering();
  } finally {
    await decodeContext.close();
  }
}

async function audioBufferToMp3Blob(buffer: AudioBuffer) {
  const lamejs = (await import("lamejs")) as {
    Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => {
      encodeBuffer: (left: Int16Array, right?: Int16Array) => Int8Array;
      flush: () => Int8Array;
    };
  };

  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);
  const blockSize = 1152;
  const mp3Chunks: Int8Array[] = [];

  const left = buffer.getChannelData(0);
  const right = channels > 1 ? buffer.getChannelData(1) : left;

  function toInt16(samples: Float32Array) {
    const converted = new Int16Array(samples.length);
    for (let index = 0; index < samples.length; index += 1) {
      const value = Math.max(-1, Math.min(1, samples[index]));
      converted[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
    }
    return converted;
  }

  for (let offset = 0; offset < left.length; offset += blockSize) {
    const leftChunk = toInt16(left.subarray(offset, offset + blockSize));
    const rightChunk = channels > 1 ? toInt16(right.subarray(offset, offset + blockSize)) : undefined;
    const encoded = encoder.encodeBuffer(leftChunk, rightChunk);
    if (encoded.length) {
      mp3Chunks.push(encoded);
    }
  }

  const flush = encoder.flush();
  if (flush.length) {
    mp3Chunks.push(flush);
  }

  return new Blob(mp3Chunks, { type: "audio/mpeg" });
}

export async function exportStoryAudioMp3(
  story: Story,
  segments: Segment[],
  assets: Record<string, AudioAsset>,
) {
  const rendered = await renderStoryAudio(segments, assets);
  const mp3Blob = await audioBufferToMp3Blob(rendered);
  downloadBlob(mp3Blob, `${story.title.replace(/[^\w-]+/g, "_")}.mp3`);
}
