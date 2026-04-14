"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type CSSProperties } from "react";
import EchoverseLogo from "@/components/EchoverseLogo";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/store/settings-store";
import { t } from "@/lib/i18n";
import { Clock, Plus, Settings } from "lucide-react";

function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const lang = useSettingsStore((state) => state.preferences.interfaceLang);

  if (pathname.startsWith("/play/")) {
    return null;
  }

  return (
    <nav className="fixed left-0 right-0 top-0 z-40 border-b border-border/30 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <button
          onClick={() => router.push("/")}
          className="group flex items-center gap-1 rounded-xl px-2 py-1.5"
        >
          <EchoverseLogo size={36} />
          <span className="font-serif text-xl font-bold text-accent">Echoverse</span>
        </button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/create")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus size={16} className="mr-1" /> {t("nav.create", lang)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/history")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Clock size={16} className="mr-1" /> {t("nav.history", lang)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/settings")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Settings size={16} />
          </Button>
        </div>
      </div>
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrate = useSettingsStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const hideNavigation = pathname.startsWith("/play/");

  return (
    <>
      <Navigation />
      <main
        className={hideNavigation ? undefined : "pt-14"}
        style={
          hideNavigation
            ? undefined
            : ({
                "--app-shell-offset": "3.5rem",
              } as CSSProperties)
        }
      >
        {children}
      </main>
    </>
  );
}
