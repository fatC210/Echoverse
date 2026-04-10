import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, RotateCcw, Download, Trash2, Clock, GitBranch, Clapperboard } from "lucide-react";

interface StoryEntry {
  id: string;
  title: string;
  genre: string;
  tags: string[];
  status: "playing" | "completed";
  createdAt: string;
  totalDurationSec: number;
  totalDecisions: number;
  endingName?: string;
}

// Demo data
const DEMO_STORIES: StoryEntry[] = [
  {
    id: "demo_1",
    title: "Echo Station",
    genre: "Sci-Fi Thriller",
    tags: ["Space", "Suspense", "Scientist"],
    status: "completed",
    createdAt: "2026-04-08T10:30:00Z",
    totalDurationSec: 1427,
    totalDecisions: 7,
    endingName: "Symbiosis",
  },
  {
    id: "demo_2",
    title: "The Midnight Garden",
    genre: "Fantasy Mystery",
    tags: ["Dreamscape", "Mystery", "Child"],
    status: "playing",
    createdAt: "2026-04-09T14:20:00Z",
    totalDurationSec: 890,
    totalDecisions: 4,
  },
  {
    id: "demo_3",
    title: "Last Train to Nowhere",
    genre: "Horror",
    tags: ["Victorian", "Horror", "Detective"],
    status: "completed",
    createdAt: "2026-04-07T22:00:00Z",
    totalDurationSec: 2100,
    totalDecisions: 9,
    endingName: "The Truth",
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
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft size={16} />
          </Button>
          <h1 className="text-2xl font-bold font-serif">{t("history.title", lang)}</h1>
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
                className="glass-panel p-5 space-y-3 hover:border-accent/30 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-serif font-semibold text-lg group-hover:text-gradient-primary transition-colors">{story.title}</h3>
                    <p className="text-xs text-muted-foreground">{story.genre}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    story.status === "completed"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-accent/20 text-accent"
                  }`}>
                    {story.status === "completed" ? "✓" : "▶"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {story.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 text-xs rounded bg-secondary text-muted-foreground">{tag}</span>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock size={12} />{formatDuration(story.totalDurationSec)}</span>
                  <span className="flex items-center gap-1"><GitBranch size={12} />{story.totalDecisions} decisions</span>
                </div>

                {story.endingName && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Clapperboard size={12} /> {story.endingName}</p>
                )}

                <p className="text-xs text-muted-foreground">
                  {new Date(story.createdAt).toLocaleDateString()}
                </p>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/play/${story.id}`)} className="flex-1 text-xs">
                    {story.status === "playing" ? <><Play size={12} className="mr-1" /> {t("history.continue", lang)}</> : <><RotateCcw size={12} className="mr-1" /> {t("history.replay", lang)}</>}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs">
                    <Download size={12} className="mr-1" /> {t("history.export", lang)}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(story.id)} className="text-destructive/70 hover:text-destructive">
                    <Trash2 size={12} />
                  </Button>
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
