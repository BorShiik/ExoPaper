import { Sparkles } from "lucide-react";
import Header from "../components/layout/Header";
import StatsOverview from "../components/dashboard/StatsOverview";
import DiscoveryChart from "../components/dashboard/DiscoveryChart";
import RecentEventsPanel from "../components/dashboard/RecentEventsPanel";
import HybridSearchBar from "../components/search/HybridSearchBar";
import { useT } from "../i18n/LanguageContext";

export default function DashboardPage() {
  const t = useT();

  return (
    <div className="h-screen w-full flex flex-col justify-between pt-24 pb-4 pl-20 pr-4 lg:pl-28 lg:pr-8 text-[#D8DEE9] overflow-hidden pointer-events-none">
      {/* 1. Header Section */}
      <div className="pointer-events-auto">
        <Header />
      </div>

      {/* 2. Middle Section (Flex-grow, centered) */}
      <div className="flex-grow flex flex-col items-center justify-center text-center pointer-events-none min-h-0 z-20 relative w-full max-w-4xl mx-auto mb-4">
        {/* Subtle radial gradient background for text readability */}
        <div className="absolute inset-0 bg-radial from-[#1e222a]/80 via-transparent to-transparent -z-10 pointer-events-none scale-150" />

        <div className="animate-hero-reveal inline-flex items-center gap-2 rounded-full border border-[#B48EAD]/30 bg-[#2E3440]/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#B48EAD] backdrop-blur-md pointer-events-auto">
          <Sparkles className="h-3.5 w-3.5" />
          {t("hero.kicker")}
        </div>

        <h1
          className="animate-hero-reveal mt-4 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl drop-shadow-[0_0_15px_rgba(216,222,233,0.3)] pointer-events-auto"
          style={{ animationDelay: "0.1s" }}
        >
          <span className="bg-gradient-to-r from-[#ECEFF4] via-[#88C0D0] to-[#5E81AC] bg-clip-text text-transparent">
            {t("hero.title")}
          </span>
        </h1>

        <p
          className="animate-hero-reveal mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#ECEFF4] sm:text-base drop-shadow-md pointer-events-auto font-medium"
          style={{ animationDelay: "0.2s" }}
        >
          {t("hero.subtitle")}
        </p>

        <div
          className="animate-hero-reveal mx-auto mt-6 w-full max-w-2xl text-left pointer-events-auto"
          style={{ animationDelay: "0.3s" }}
        >
          <div className="group relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#B48EAD] to-[#88C0D0] opacity-0 blur transition duration-500 group-hover:opacity-20 group-focus-within:opacity-40"></div>
            <div className="relative">
              <HybridSearchBar />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Section (Metrics and Panels, min-h-0 for flex parent) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 pointer-events-none z-10 shrink-0 mb-2 min-h-0 w-full">
        
        <div className="lg:col-span-12 pointer-events-auto animate-slide-in-right" style={{ animationDelay: "0.4s", animationFillMode: "both" }}>
          <div className="rounded-2xl border border-[#D8DEE9]/10 bg-[#2E3440]/40 backdrop-blur-xl p-4 shadow-lg">
             <StatsOverview />
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-7 pointer-events-auto animate-slide-in-right min-h-0" style={{ animationDelay: "0.5s", animationFillMode: "both" }}>
          <div className="h-[210px] rounded-2xl border border-[#D8DEE9]/10 bg-[#2E3440]/40 backdrop-blur-xl p-4 shadow-lg flex flex-col min-h-0">
             <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#81A1C1] shrink-0">
              {t("dash.discoveryMethods")}
             </h3>
             <div className="flex-grow overflow-y-auto custom-scrollbar min-h-0">
               <DiscoveryChart />
             </div>
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-5 pointer-events-auto animate-slide-in-right min-h-0" style={{ animationDelay: "0.6s", animationFillMode: "both" }}>
          <div className="h-[210px] rounded-2xl border border-[#D8DEE9]/10 bg-[#2E3440]/40 backdrop-blur-xl p-4 shadow-lg flex flex-col min-h-0">
             <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#81A1C1] shrink-0">
              {t("dash.liveFeed")}
             </h3>
             <div className="flex-grow overflow-y-auto custom-scrollbar min-h-0">
               <RecentEventsPanel />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
