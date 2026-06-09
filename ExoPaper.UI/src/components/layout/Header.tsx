import { RefreshCw, Satellite, Menu, MonitorPlay } from "lucide-react";
import { triggerNasaSync, triggerArxivHarvest } from "../../api/sync";
import { useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { useT } from "../../i18n/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Header({ title }: { title?: string }) {
  const [syncing, setSyncing] = useState<string | null>(null);
  const toggleMobileNav = useAppStore((s) => s.toggleMobileNav);
  const graphicsQuality = useAppStore((s) => s.graphicsQuality);
  const setGraphicsQuality = useAppStore((s) => s.setGraphicsQuality);
  const t = useT();

  const handleSync = async (type: "nasa" | "arxiv") => {
    setSyncing(type);
    try {
      if (type === "nasa") await triggerNasaSync();
      else await triggerArxivHarvest();
    } catch (e) {
      console.error("Sync trigger failed:", e);
    } finally {
      setTimeout(() => setSyncing(null), 1500);
    }
  };

  return (
    <header className="fixed top-4 left-20 right-4 lg:left-24 lg:right-8 z-20 flex h-14 items-center justify-between gap-2 rounded-2xl border border-[#434C5E] bg-[#2E3440]/30 backdrop-blur-md px-4 sm:px-6 shadow-lg pointer-events-auto transition-all">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={toggleMobileNav}
          aria-label={t("nav.menu")}
          className="lg:hidden rounded-lg p-2 text-[#D8DEE9] hover:text-[#ECEFF4] hover:bg-[#3B4252]/60 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        {title && (
          <h2 className="truncate text-base sm:text-lg font-semibold text-text-primary">
            {title}
          </h2>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => handleSync("nasa")}
          disabled={syncing !== null}
          className="group flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-[#D8DEE9] hover:text-[#A3BE8C] hover:bg-[#A3BE8C]/10 hover:shadow-[0_0_10px_rgba(163,190,140,0.2)] border border-transparent hover:border-[#A3BE8C]/30 transition-all duration-300 disabled:opacity-40"
        >
          <Satellite className={`h-3.5 w-3.5 group-hover:drop-shadow-[0_0_5px_rgba(163,190,140,0.8)] ${syncing === "nasa" ? "animate-spin text-[#A3BE8C]" : ""}`} />
          <span className="hidden sm:inline">{t("header.nasaSync")}</span>
        </button>
        <button
          onClick={() => handleSync("arxiv")}
          disabled={syncing !== null}
          className="group flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-[#D8DEE9] hover:text-[#B48EAD] hover:bg-[#B48EAD]/10 hover:shadow-[0_0_10px_rgba(180,142,173,0.2)] border border-transparent hover:border-[#B48EAD]/30 transition-all duration-300 disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 group-hover:drop-shadow-[0_0_5px_rgba(180,142,173,0.8)] ${syncing === "arxiv" ? "animate-spin text-[#B48EAD]" : ""}`} />
          <span className="hidden sm:inline">{t("header.arxivHarvest")}</span>
        </button>

        <div className="mx-0.5 h-5 w-px bg-border hidden sm:block" />
        
        <button
          onClick={() => setGraphicsQuality(graphicsQuality === "high" ? "low" : "high")}
          title={`${t("header.graphics")}: ${graphicsQuality.toUpperCase()}`}
          className={`group flex items-center justify-center rounded-xl p-1.5 transition-all duration-300 border ${
            graphicsQuality === "high"
              ? "text-[#88C0D0] bg-[#88C0D0]/10 border-[#88C0D0]/30 shadow-[0_0_10px_rgba(136,192,208,0.2)]"
              : "text-[#D8DEE9] border-transparent hover:text-[#ECEFF4] hover:bg-[#3B4252]/60 hover:border-[#434C5E]"
          }`}
        >
          <MonitorPlay className="h-4 w-4" />
        </button>

        <div className="mx-0.5 h-5 w-px bg-border" />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
