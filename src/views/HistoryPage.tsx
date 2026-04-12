"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { deleteStoryCascade, getStory, listSegmentsByStory, listStories } from "@/lib/db";
import { exportStoryMarkdown, exportWorldJson } from "@/lib/engine/exporter";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils/echoverse";
import type { Story } from "@/lib/types/echoverse";
import { ArrowLeft, Play, RotateCcw, Download, Trash2, Clock, GitBranch, Clapperboard, MoreVertical, Package } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const HistoryPage = () => {
  const router = useRouter();
  const lang = useSettingsStore((state) => state.preferences.interfaceLang);
  const [stories, setStories] = useState<Story[]>([]);

  const refreshStories = async () => {
    setStories(await listStories());
  };

  useEffect(() => {
    void refreshStories();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm(t("history.deleteConfirm", lang))) {
      await deleteStoryCascade(id);
      await refreshStories();
    }
  };

  const handleExportText = async (id: string) => {
    const story = await getStory(id);
    if (!story) return;
    const segments = await listSegmentsByStory(id);
    exportStoryMarkdown(story, segments);
  };

  const handleExportWorld = async (id: string) => {
    const story = await getStory(id);
    if (!story) return;
    exportWorldJson(story);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} />
          </Button>
          <h1 className="font-serif text-2xl font-bold text-accent">{t("history.title", lang)}</h1>
        </div>

        {stories.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <p className="text-lg">{t("history.empty", lang)}</p>
            <Button onClick={() => router.push("/create")} className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
              {t("home.hero.cta.first", lang)}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stories.map((story, index) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="glass-panel group flex cursor-pointer flex-col p-5 transition-colors hover:border-accent/30"
                onClick={() => router.push(story.status === "completed" ? `/play/${story.id}?view=summary` : `/play/${story.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-serif text-lg font-semibold transition-colors group-hover:text-gradient-primary">{story.title}</h3>
                    <p className="text-xs text-muted-foreground">{story.genre}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${story.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : "bg-accent/20 text-accent"}`}>
                    {story.status === "completed" ? t("history.status.completed", lang) : t("history.status.playing", lang)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {[...story.tags.preset, ...story.tags.custom].slice(0, 6).map((tag) => (
                    <span key={tag} className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{tag}</span>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock size={12} />{formatDuration(story.totalDurationSec)}</span>
                  <span className="flex items-center gap-1"><GitBranch size={12} />{story.totalDecisions} {t("history.decisions", lang)}</span>
                </div>

                {story.endingName ? (
                  <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><Clapperboard size={12} /> {t("history.ending", lang)}: {story.endingName}</p>
                ) : null}

                <div className="mt-auto flex items-center justify-between pt-3">
                  <p className="text-xs text-muted-foreground">{new Date(story.createdAt).toLocaleDateString()}</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(event) => event.stopPropagation()}>
                        <MoreVertical size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={(event) => { event.stopPropagation(); router.push(story.status === "completed" ? `/play/${story.id}?view=summary` : `/play/${story.id}`); }}>
                        {story.status === "playing" ? <><Play size={14} className="mr-2" /> {t("history.continue", lang)}</> : <><RotateCcw size={14} className="mr-2" /> {t("history.replay", lang)}</>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(event) => { event.stopPropagation(); void handleExportText(story.id); }}>
                        <Download size={14} className="mr-2" /> {t("history.export", lang)}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(event) => { event.stopPropagation(); void handleExportWorld(story.id); }}>
                        <Package size={14} className="mr-2" /> {lang === "zh" ? "导出世界" : "Export World"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(event) => { event.stopPropagation(); void handleDelete(story.id); }} className="text-destructive focus:text-destructive">
                        <Trash2 size={14} className="mr-2" /> {t("history.delete", lang)}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
