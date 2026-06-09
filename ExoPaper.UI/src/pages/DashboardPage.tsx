import { useState, useEffect, useRef } from "react";
import { Sparkles, Brain, X, BookOpen, ChevronRight } from "lucide-react";
import Header from "../components/layout/Header";
import StatsOverview from "../components/dashboard/StatsOverview";
import DiscoveryChart from "../components/dashboard/DiscoveryChart";
import RecentEventsPanel from "../components/dashboard/RecentEventsPanel";
import HybridSearchBar from "../components/search/HybridSearchBar";
import { useT } from "../i18n/LanguageContext";
import { useAppStore } from "../stores/appStore";

export default function DashboardPage() {
  const t = useT();
  const connection = useAppStore((s) => s.connection);
  const isConnected = useAppStore((s) => s.isConnected);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ answer: string; sources: { paperId: string; title: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  const subRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    return () => subRef.current?.dispose();
  }, []);

  // Cycle through loading steps for realistic feedback
  useEffect(() => {
    if (!isSearching) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((s) => (s < 2 ? s + 1 : s));
    }, 1500);
    return () => clearInterval(interval);
  }, [isSearching]);

  const handleGlobalSearch = (
    text: string,
    _maxMass: number | null,
    _discoveryMethod: string,
    _take: number
  ) => {
    if (!connection || !isConnected || !text.trim()) {
      setError("RAG search requires a live SignalR connection.");
      setIsPanelOpen(true);
      return;
    }

    subRef.current?.dispose();
    setSearchQuery(text);
    setSearchResults(null);
    setError(null);
    setIsSearching(true);
    setStreaming(true);
    setIsPanelOpen(true);

    subRef.current = connection
      .stream("StreamAsk", {
        question: text.trim(),
        exoplanetId: null,
        take: 6,
      })
      .subscribe({
        next: (chunk: any) => {
          if (chunk?.type === "sources") {
            const currentSources = chunk.sources ?? [];
            setSearchResults((prev) => ({
              answer: prev?.answer ?? "",
              sources: currentSources,
            }));
          } else if (chunk?.type === "token") {
            setIsSearching(false);
            const token = chunk.content ?? "";
            setSearchResults((prev) => ({
              answer: (prev?.answer ?? "") + token,
              sources: prev?.sources ?? [],
            }));
          }
        },
        complete: () => {
          setStreaming(false);
          setIsSearching(false);
        },
        error: (e: unknown) => {
          console.error("RAG search stream error:", e);
          setError("Astrophysics model server is unavailable or offline.");
          setStreaming(false);
          setIsSearching(false);
        },
      });
  };

  return (
    <div className="h-screen w-full flex flex-col justify-between pt-24 pb-4 pl-20 pr-4 lg:pl-28 lg:pr-8 text-[#D8DEE9] overflow-hidden relative">
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
              <HybridSearchBar onSearch={handleGlobalSearch} isSearchingGlobal={isSearching || streaming} />
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

      {/* 4. Sliding Glassmorphic RAG Search Side Panel */}
      <div
        className={`fixed top-4 right-4 bottom-4 w-[450px] max-w-[calc(100vw-32px)] z-50 bg-[#2E3440]/60 backdrop-blur-2xl border-l border-[#434C5E]/50 shadow-2xl rounded-l-2xl transition-transform duration-500 ease-out pointer-events-auto flex flex-col p-6 text-[#D8DEE9] ${
          isPanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-[#434C5E]/30 pb-4 shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-[#B48EAD] animate-pulse" />
            <h2 className="text-base font-semibold text-[#ECEFF4] uppercase tracking-wider">
              RAG AI Search
            </h2>
          </div>
          <button
            onClick={() => {
              setIsPanelOpen(false);
              subRef.current?.dispose();
              setStreaming(false);
              setIsSearching(false);
            }}
            className="rounded-lg p-1.5 text-text-muted hover:text-[#ECEFF4] hover:bg-[#3B4252]/60 border border-transparent hover:border-[#434C5E]/40 transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Panel Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 mt-4 min-h-0 space-y-6">
          
          {/* Query grounding block */}
          {searchQuery && (
            <div className="rounded-xl bg-[#2E3440]/30 border border-[#434C5E]/30 p-3 text-xs">
              <span className="text-text-muted font-mono block uppercase text-[10px] tracking-wider mb-1">
                Active Query
              </span>
              <p className="text-[#ECEFF4] font-medium italic">
                "{searchQuery}"
              </p>
            </div>
          )}

          {/* Offline / Error Message */}
          {error && (
            <div className="rounded-xl bg-accent-red/10 border border-accent-red/20 p-4 text-xs text-accent-red">
              <p className="font-semibold mb-1">System Error</p>
              <p>{error}</p>
            </div>
          )}

          {/* Futuristic Loading State (No generic spinners, custom pulse text and aurora colors shimmer) */}
          {isSearching && (
            <div className="space-y-6 animate-fade-in">
              <div className="rounded-xl border border-[#B48EAD]/20 bg-[#B48EAD]/5 p-4 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#B48EAD]">
                  <Brain className="h-4 w-4 animate-pulse text-[#B48EAD]" />
                  <span className="animate-pulse">COGNITIVE PROCESSOR ACTIVE</span>
                </div>
                
                <div className="space-y-2.5 font-mono text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${loadingStep >= 0 ? "bg-[#A3BE8C]" : "bg-[#B48EAD] animate-pulse"}`} />
                    <span className={loadingStep === 0 ? "text-[#ECEFF4] font-bold animate-pulse" : "text-[#D8DEE9]/50"}>
                      Initializing Hybrid Vector Search...
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${loadingStep >= 1 ? "bg-[#A3BE8C]" : loadingStep === 0 ? "bg-transparent border border-[#434C5E]" : "bg-[#B48EAD] animate-pulse"}`} />
                    <span className={loadingStep === 1 ? "text-[#ECEFF4] font-bold animate-pulse" : "text-[#D8DEE9]/50"}>
                      Querying RavenDB Vector Index...
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${loadingStep >= 2 ? "bg-[#A3BE8C]" : loadingStep < 2 ? "bg-transparent border border-[#434C5E]" : "bg-[#B48EAD] animate-pulse"}`} />
                    <span className={loadingStep === 2 ? "text-[#ECEFF4] font-bold animate-pulse" : "text-[#D8DEE9]/50"}>
                      Generating Llama3 Synthesis...
                    </span>
                  </div>
                </div>
              </div>

              {/* Shimmer skeleton lines using Nord Aurora/Frost colors */}
              <div className="space-y-3">
                <div className="h-4 rounded-md w-3/4 animate-shimmer-aurora" />
                <div className="h-3 rounded-md w-full animate-shimmer-aurora" />
                <div className="h-3 rounded-md w-5/6 animate-shimmer-aurora" />
                <div className="h-3 rounded-md w-2/3 animate-shimmer-aurora" />
              </div>
            </div>
          )}

          {/* AI Response Summary Box (AI Summary Section) */}
          {searchResults?.answer && (
            <div className="rounded-xl border border-[#B48EAD]/30 bg-[#B48EAD]/5 p-5 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2 text-[#B48EAD] font-semibold text-xs mb-3">
                <Sparkles className="h-4 w-4" />
                <span>AI SYNTHESIS</span>
              </div>
              <p className="text-xs sm:text-[13px] text-[#ECEFF4] leading-relaxed whitespace-pre-wrap font-medium">
                {searchResults.answer}
                {streaming && (
                  <span className="ml-1 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-[#B48EAD]" />
                )}
              </p>
            </div>
          )}

          {/* Citation Sources List (Sources List with Nord hover styles) */}
          {searchResults?.sources && searchResults.sources.length > 0 && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-[#88C0D0] font-semibold text-xs">
                <BookOpen className="h-4 w-4" />
                <span>GROUNDING PUBLICATIONS</span>
              </div>
              <div className="space-y-2">
                {searchResults.sources.map((s, i) => (
                  <div
                    key={s.paperId}
                    className="group flex items-start gap-3 rounded-xl border border-[#434C5E]/30 bg-[#2E3440]/30 hover:bg-[#3B4252]/50 hover:border-[#434C5E]/60 p-3 transition-all duration-200 cursor-pointer pointer-events-auto"
                  >
                    <span className="text-[#88C0D0] font-mono text-xs font-bold shrink-0 mt-0.5">
                      [{i + 1}]
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-[#ECEFF4] line-clamp-1 mb-0.5 group-hover:text-[#88C0D0] transition-colors">
                        {s.title}
                      </h4>
                      <p className="text-[10px] text-text-muted font-mono">
                        Document ID: {s.paperId.split("/").pop()}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-text-muted shrink-0 self-center group-hover:text-[#88C0D0] group-hover:translate-x-0.5 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
