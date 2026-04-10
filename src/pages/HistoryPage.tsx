import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, RotateCcw, Download, Trash2, Clock, GitBranch, Clapperboard, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StoryEntry {
  id: string;
  titleKey: string;
  genreKey: string;
  tagKeys: string[];
  status: "playing" | "completed";
  createdAt: string;
  totalDurationSec: number;
  totalDecisions: number;
  endingKey?: string;
}

// Demo data
const DEMO_STORIES: StoryEntry[] = [
  {
    id: "demo_1",
    titleKey: "history.demo1.title",
    genreKey: "history.demo1.genre",
    tagKeys: ["history.tag.space", "history.tag.suspense", "history.tag.scientist"],
    status: "completed",
    createdAt: "2026-04-08T10:30:00Z",
    totalDurationSec: 1427,
    totalDecisions: 7,
    endingKey: "history.demo1.ending",
  },
  {
    id: "demo_2",
    titleKey: "history.demo2.title",
    genreKey: "history.demo2.genre",
    tagKeys: ["history.tag.dreamscape", "history.tag.mystery", "history.tag.child"],
    status: "playing",
    createdAt: "2026-04-09T14:20:00Z",
    totalDurationSec: 890,
    totalDecisions: 4,
  },
  {
    id: "demo_3",
    titleKey: "history.demo3.title",
    genreKey: "history.demo3.genre",
    tagKeys: ["history.tag.victorian", "history.tag.horror", "history.tag.detective"],
    status: "completed",
    createdAt: "2026-04-07T22:00:00Z",
    totalDurationSec: 2100,
    totalDecisions: 9,
    endingKey: "history.demo3.ending",
  },
];

const formatDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const HistoryPage = () => {
  const navigate = useNavigate();
  const lang = useSettingsStore((s) => s.preferences.interfaceLang);
  const [stories] = useState<StoryEntry[]>(DEMO_STORIES);

  const handleDelete = (id: string) => {
    if (window.confirm(t("history.deleteConfirm", lang))) {
      // Would delete from IndexedDB
      console.log("Delete", id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} />
          </Button>
          <h1 className="text-2xl font-bold font-serif text-accent">{t("history.title", lang)}</h1>
        </div>

        {stories.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">{t("history.empty", lang)}</p>
            <Button onClick={() => navigate("/create")} className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground">
              {t("home.hero.cta.first", lang)}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stories.map((story, i) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-panel p-5 flex flex-col hover:border-accent/30 transition-colors group cursor-pointer"
                onClick={() => navigate(`/play/${story.id}?view=summary`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-serif font-semibold text-lg group-hover:text-gradient-primary transition-colors">{t(story.titleKey, lang)}</h3>
                    <p className="text-xs text-muted-foreground">{t(story.genreKey, lang)}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    story.status === "completed"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-accent/20 text-accent"
                  }`}>
                    {story.status === "completed" ? t("history.status.completed", lang) : t("history.status.playing", lang)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 mt-3">
                  {story.tagKeys.map((tagKey) => (
                    <span key={tagKey} className="px-2 py-0.5 text-xs rounded bg-secondary text-muted-foreground">{t(tagKey, lang)}</span>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                  <span className="flex items-center gap-1"><Clock size={12} />{formatDuration(story.totalDurationSec)}</span>
                  <span className="flex items-center gap-1"><GitBranch size={12} />{story.totalDecisions} {t("history.decisions", lang)}</span>
                </div>

                {story.endingKey && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-3"><Clapperboard size={12} /> {t("history.ending", lang)}: {t(story.endingKey, lang)}</p>
                )}

                <div className="flex items-center justify-between mt-auto pt-3">
                  <p className="text-xs text-muted-foreground">
                    {new Date(story.createdAt).toLocaleDateString()}
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/play/${story.id}`); }}>
                        {story.status === "playing"
                          ? <><Play size={14} className="mr-2" /> {t("history.continue", lang)}</>
                          : <><RotateCcw size={14} className="mr-2" /> {t("history.replay", lang)}</>
                        }
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                        <Download size={14} className="mr-2" /> {t("history.export", lang)}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(story.id); }} className="text-destructive focus:text-destructive">
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
