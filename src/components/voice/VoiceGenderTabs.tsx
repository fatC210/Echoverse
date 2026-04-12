"use client";

import { Button } from "@/components/ui/button";
import type { Language } from "@/lib/types/echoverse";
import { cn } from "@/lib/utils";
import type { VoiceGenderFilter } from "@/lib/utils/voices";

const VOICE_FILTER_LABELS: Record<
  VoiceGenderFilter,
  Record<Language, string>
> = {
  all: {
    en: "All",
    zh: "全部",
  },
  female: {
    en: "Female",
    zh: "女",
  },
  male: {
    en: "Male",
    zh: "男",
  },
};

interface VoiceGenderTabsProps {
  lang: Language;
  value: VoiceGenderFilter;
  onChange: (value: VoiceGenderFilter) => void;
  className?: string;
}

export function VoiceGenderTabs({
  lang,
  value,
  onChange,
  className,
}: VoiceGenderTabsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {(["all", "female", "male"] as const).map((filter) => (
        <Button
          key={filter}
          type="button"
          size="sm"
          variant={value === filter ? "default" : "outline"}
          onClick={() => onChange(filter)}
          className={
            value === filter
              ? "bg-accent text-accent-foreground"
              : "border-accent/30 hover:border-accent/60"
          }
        >
          {VOICE_FILTER_LABELS[filter][lang]}
        </Button>
      ))}
    </div>
  );
}
