import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  AudioAsset,
  CustomTag,
  Decision,
  PlayerProfile,
  Segment,
  Story,
} from "@/lib/types/echoverse";

const DB_NAME = "echoverse_db";
const DB_VERSION = 2;

interface EchoverseDB extends DBSchema {
  stories: {
    key: string;
    value: Story;
    indexes: {
      "by-updatedAt": string;
      "by-status": Story["status"];
    };
  };
  segments: {
    key: string;
    value: Segment;
    indexes: {
      "by-storyId": string;
      "by-storyId-createdAt": [string, string];
    };
  };
  audio_assets: {
    key: string;
    value: AudioAsset;
    indexes: {
      "by-storyId": string;
      "by-storyId-category": [string, AudioAsset["category"]];
    };
  };
  decisions: {
    key: string;
    value: Decision;
    indexes: {
      "by-storyId": string;
      "by-segmentId": string;
    };
  };
  player_profile: {
    key: string;
    value: PlayerProfile;
    indexes: {
      "by-storyId": string;
    };
  };
  custom_tags: {
    key: string;
    value: CustomTag;
    indexes: {
      "by-createdAt": string;
      "by-usageCount": number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<EchoverseDB>> | null = null;

function normalizeCustomTagText(text: string) {
  return text.trim();
}

function buildCustomTagId(text: string) {
  return normalizeCustomTagText(text).toLowerCase().replace(/\s+/g, "-");
}

function ensureIndex(
  store: {
    indexNames: DOMStringList;
    createIndex: (name: string, keyPath: string | string[]) => unknown;
  },
  name: string,
  keyPath: string | string[],
) {
  if (!store.indexNames.contains(name)) {
    store.createIndex(name, keyPath);
  }
}

function ensureDb() {
  if (!dbPromise) {
    dbPromise = openDB<EchoverseDB>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, tx) {
        const stories = db.objectStoreNames.contains("stories")
          ? tx.objectStore("stories")
          : db.createObjectStore("stories", { keyPath: "id" });
        ensureIndex(stories, "by-updatedAt", "updatedAt");
        ensureIndex(stories, "by-status", "status");

        const segments = db.objectStoreNames.contains("segments")
          ? tx.objectStore("segments")
          : db.createObjectStore("segments", { keyPath: "id" });
        ensureIndex(segments, "by-storyId", "storyId");
        ensureIndex(segments, "by-storyId-createdAt", ["storyId", "createdAt"]);

        const audioAssets = db.objectStoreNames.contains("audio_assets")
          ? tx.objectStore("audio_assets")
          : db.createObjectStore("audio_assets", { keyPath: "id" });
        ensureIndex(audioAssets, "by-storyId", "storyId");
        ensureIndex(audioAssets, "by-storyId-category", ["storyId", "category"]);

        const decisions = db.objectStoreNames.contains("decisions")
          ? tx.objectStore("decisions")
          : db.createObjectStore("decisions", { keyPath: "id" });
        ensureIndex(decisions, "by-storyId", "storyId");
        ensureIndex(decisions, "by-segmentId", "segmentId");

        const profiles = db.objectStoreNames.contains("player_profile")
          ? tx.objectStore("player_profile")
          : db.createObjectStore("player_profile", { keyPath: "id" });
        ensureIndex(profiles, "by-storyId", "storyId");

        const customTags = db.objectStoreNames.contains("custom_tags")
          ? tx.objectStore("custom_tags")
          : db.createObjectStore("custom_tags", { keyPath: "id" });
        ensureIndex(customTags, "by-createdAt", "createdAt");
        ensureIndex(customTags, "by-usageCount", "usageCount");
      },
    });
  }

  return dbPromise;
}

function sortByDateDesc<T extends { updatedAt?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftDate = left.updatedAt ?? left.createdAt ?? "";
    const rightDate = right.updatedAt ?? right.createdAt ?? "";
    return rightDate.localeCompare(leftDate);
  });
}

export async function listStories() {
  const db = await ensureDb();
  const stories = await db.getAll("stories");
  return sortByDateDesc(stories);
}

export async function getStory(id: string) {
  const db = await ensureDb();
  return db.get("stories", id);
}

export async function putStory(story: Story) {
  const db = await ensureDb();
  await db.put("stories", story);
  return story;
}

export async function deleteStoryCascade(storyId: string) {
  const db = await ensureDb();
  const tx = db.transaction(
    ["stories", "segments", "audio_assets", "decisions", "player_profile"],
    "readwrite",
  );

  await tx.objectStore("stories").delete(storyId);

  const segmentCursor = await tx.objectStore("segments").index("by-storyId").openCursor(storyId);
  let segmentPointer = segmentCursor;
  while (segmentPointer) {
    await segmentPointer.delete();
    segmentPointer = await segmentPointer.continue();
  }

  const assetCursor = await tx.objectStore("audio_assets").index("by-storyId").openCursor(storyId);
  let assetPointer = assetCursor;
  while (assetPointer) {
    await assetPointer.delete();
    assetPointer = await assetPointer.continue();
  }

  const decisionCursor = await tx.objectStore("decisions").index("by-storyId").openCursor(storyId);
  let decisionPointer = decisionCursor;
  while (decisionPointer) {
    await decisionPointer.delete();
    decisionPointer = await decisionPointer.continue();
  }

  const profileCursor = await tx.objectStore("player_profile").index("by-storyId").openCursor(storyId);
  let profilePointer = profileCursor;
  while (profilePointer) {
    await profilePointer.delete();
    profilePointer = await profilePointer.continue();
  }

  await tx.done;
}

export async function listSegmentsByStory(storyId: string) {
  const db = await ensureDb();
  const segments = await db.getAllFromIndex("segments", "by-storyId", storyId);
  return segments.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function getSegment(id: string) {
  const db = await ensureDb();
  return db.get("segments", id);
}

export async function putSegment(segment: Segment) {
  const db = await ensureDb();
  await db.put("segments", segment);
  return segment;
}

export async function listAudioAssetsByStory(storyId: string) {
  const db = await ensureDb();
  return db.getAllFromIndex("audio_assets", "by-storyId", storyId);
}

export async function listAudioAssetsByStoryAndCategory(
  storyId: string,
  category: AudioAsset["category"],
) {
  const db = await ensureDb();
  return db.getAllFromIndex("audio_assets", "by-storyId-category", [storyId, category]);
}

export async function getAudioAsset(id: string) {
  const db = await ensureDb();
  return db.get("audio_assets", id);
}

export async function putAudioAsset(asset: AudioAsset) {
  const db = await ensureDb();
  await db.put("audio_assets", asset);
  return asset;
}

export async function bumpAudioAssetUsage(id: string) {
  const asset = await getAudioAsset(id);

  if (!asset) {
    return;
  }

  await putAudioAsset({
    ...asset,
    timesUsed: asset.timesUsed + 1,
  });
}

export async function listDecisionsByStory(storyId: string) {
  const db = await ensureDb();
  const decisions = await db.getAllFromIndex("decisions", "by-storyId", storyId);
  return decisions.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export async function putDecision(decision: Decision) {
  const db = await ensureDb();
  await db.put("decisions", decision);
  return decision;
}

export async function getPlayerProfile(storyId: string) {
  const db = await ensureDb();
  const tx = db.transaction("player_profile", "readonly");
  const store = tx.objectStore("player_profile");
  const profiles = store.indexNames.contains("by-storyId")
    ? await store.index("by-storyId").getAll(storyId)
    : (await store.getAll()).filter((profile) => profile.storyId === storyId);
  await tx.done;
  return profiles[0];
}

export async function putPlayerProfile(profile: PlayerProfile) {
  const db = await ensureDb();
  await db.put("player_profile", profile);
  return profile;
}

export async function listCustomTags() {
  const db = await ensureDb();
  const tags = await db.getAll("custom_tags");

  return [...tags].sort((left, right) => {
    if (left.usageCount !== right.usageCount) {
      return right.usageCount - left.usageCount;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

export async function putCustomTag(tag: CustomTag) {
  const db = await ensureDb();
  await db.put("custom_tags", tag);
  return tag;
}

export async function upsertCustomTag(text: string) {
  const normalized = normalizeCustomTagText(text);
  if (!normalized) {
    return null;
  }

  const tags = await listCustomTags();
  const existing = tags.find((tag) => tag.text.toLowerCase() === normalized.toLowerCase());

  if (existing) {
    const next = {
      ...existing,
      usageCount: existing.usageCount + 1,
    };
    await putCustomTag(next);
    return next;
  }

  const tag = {
    id: buildCustomTagId(normalized),
    text: normalized,
    createdAt: new Date().toISOString(),
    usageCount: 1,
  } satisfies CustomTag;

  await putCustomTag(tag);
  return tag;
}

export async function deleteCustomTag(text: string) {
  const normalized = normalizeCustomTagText(text);
  if (!normalized) {
    return;
  }

  const db = await ensureDb();
  const tx = db.transaction("custom_tags", "readwrite");
  const store = tx.objectStore("custom_tags");
  const existing = (await store.getAll()).find(
    (tag) => tag.text.toLowerCase() === normalized.toLowerCase(),
  );

  await store.delete(existing?.id ?? buildCustomTagId(normalized));
  await tx.done;
}

export async function clearAllIndexedDbData() {
  const db = await ensureDb();
  const tx = db.transaction(
    ["stories", "segments", "audio_assets", "decisions", "player_profile", "custom_tags"],
    "readwrite",
  );

  await Promise.all([
    tx.objectStore("stories").clear(),
    tx.objectStore("segments").clear(),
    tx.objectStore("audio_assets").clear(),
    tx.objectStore("decisions").clear(),
    tx.objectStore("player_profile").clear(),
    tx.objectStore("custom_tags").clear(),
  ]);

  await tx.done;
}
