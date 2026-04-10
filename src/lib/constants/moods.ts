export type MoodType =
  | "dread"
  | "wonder"
  | "tension"
  | "peace"
  | "horror"
  | "adventure"
  | "joy"
  | "melancholy"
  | "mystery";

export interface MoodConfig {
  colors: [string, string, string];
  animation: string;
  duration: string;
  label: { en: string; zh: string };
}

export const MOOD_MAP: Record<MoodType, MoodConfig> = {
  dread: {
    colors: ["#1a0000", "#0a0a0f", "#1a0005"],
    animation: "animate-pulse-slow",
    duration: "8s",
    label: { en: "Dread", zh: "恐惧" },
  },
  wonder: {
    colors: ["#001a2c", "#0a0a1f", "#002a2c"],
    animation: "animate-drift",
    duration: "12s",
    label: { en: "Wonder", zh: "惊奇" },
  },
  tension: {
    colors: ["#1a1a00", "#0f0a00", "#1a0a00"],
    animation: "animate-pulse-slow",
    duration: "4s",
    label: { en: "Tension", zh: "紧张" },
  },
  peace: {
    colors: ["#001a1a", "#0a0f1a", "#001a2a"],
    animation: "animate-drift",
    duration: "16s",
    label: { en: "Peace", zh: "平静" },
  },
  horror: {
    colors: ["#0a0000", "#000000", "#0a0005"],
    animation: "animate-flicker",
    duration: "4s",
    label: { en: "Horror", zh: "恐怖" },
  },
  adventure: {
    colors: ["#0a1a00", "#1a1a0a", "#001a0a"],
    animation: "animate-drift",
    duration: "8s",
    label: { en: "Adventure", zh: "冒险" },
  },
  joy: {
    colors: ["#1a1a00", "#1a0a1a", "#001a1a"],
    animation: "animate-drift",
    duration: "6s",
    label: { en: "Joy", zh: "欢快" },
  },
  melancholy: {
    colors: ["#0a0a1a", "#0a0f1a", "#1a0a1a"],
    animation: "animate-pulse-slow",
    duration: "10s",
    label: { en: "Melancholy", zh: "忧伤" },
  },
  mystery: {
    colors: ["#0f001a", "#0a0a1f", "#1a001a"],
    animation: "animate-drift",
    duration: "14s",
    label: { en: "Mystery", zh: "神秘" },
  },
};
