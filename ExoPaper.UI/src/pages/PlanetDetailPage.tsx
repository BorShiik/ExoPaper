import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Info, Loader2, Gauge, Brain, BookOpen, Telescope, Tag } from "lucide-react";
import Header from "../components/layout/Header";
import { getExoplanetById } from "../api/exoplanets";
import type { Exoplanet } from "../types";
import { useT } from "../i18n/LanguageContext";
import { methodLabel } from "../lib/utils";

import ParametersGrid from "../components/planet/ParametersGrid";
import UncertaintyPanel from "../components/planet/UncertaintyPanel";
import LinkedPapers from "../components/planet/LinkedPapers";
import AskPanel from "../components/planet/AskPanel";
import ExoplanetScene from "../components/three/ExoplanetScene";
import PlanetSummaryPanel from "../components/planet/PlanetSummaryPanel";

type TabKey = "params" | "ai" | "lit";

export default function PlanetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const [planet, setPlanet] = useState<Exoplanet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("params");

  const fullId = id && !id.startsWith("exoplanets/") ? `exoplanets/${id}` : id;

  useEffect(() => {
    if (!fullId) return;
    let active = true;
    const fetchPlanet = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getExoplanetById(fullId);
        if (active) setPlanet(data);
      } catch (e) {
        console.error(e);
        if (active) setError(t("planet.notFound"));
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchPlanet();
    return () => {
      active = false;
    };
  }, [fullId, t]);

  const TABS: { key: TabKey; label: string; icon: typeof Gauge }[] = [
    { key: "params", label: t("param.title"), icon: Gauge },
    { key: "ai", label: t("unc.aiAnalysis"), icon: Brain },
    { key: "lit", label: t("linked.title"), icon: BookOpen },
  ];

  return (
    <div className="relative h-screen overflow-hidden pointer-events-auto text-[#E5E9F0]">
      <div className="absolute top-4 left-0 w-full z-50">
        <Header title={t("page.planet")} />
      </div>

      {loading && (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#88C0D0]" />
          <p className="text-xs text-[#9aa7bd]">{t("planet.decoding")}</p>
        </div>
      )}

      {error && !loading && (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-[#BF616A]/25 bg-[#BF616A]/5 p-6 text-center">
            <Info className="mx-auto mb-2 h-6 w-6 text-[#BF616A]" />
            <p className="mb-1 text-xs font-semibold text-[#ECEFF4]">{t("planet.retrievalFailed")}</p>
            <p className="mb-4 text-xs text-[#9aa7bd]">{error}</p>
            <button
              onClick={() => navigate("/planets")}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold hover:bg-white/[0.08] transition-colors"
            >
              {t("planet.returnHome")}
            </button>
          </div>
        </div>
      )}

      {!loading && !error && planet && (
        <div className="flex flex-col lg:h-screen lg:flex-row">
          {/* ───────── LEFT 60% · 3D viewport (orbit-controls enabled) ───────── */}
          <div className="relative h-[55vh] w-full lg:h-screen lg:w-3/5">
            <ExoplanetScene planet={planet} />

            {/* Top scrim for header + controls readability */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
            {/* Bottom scrim for the title overlay */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 to-transparent" />

            {/* Back button */}
            <button
              onClick={() => navigate(-1)}
              className="pointer-events-auto absolute left-4 top-20 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 text-xs font-medium text-[#D8DEE9] backdrop-blur-md transition-all hover:border-white/25 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("planet.back")}
            </button>

            {/* Model badge */}
            <span className="pointer-events-none absolute right-4 top-20 z-10 rounded-full border border-[#88C0D0]/20 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#88C0D0] backdrop-blur-md">
              {t("planet.model3d")}
            </span>

            {/* Title overlay */}
            <div className="pointer-events-none absolute bottom-6 left-6 right-6 z-10">
              <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,1)] sm:text-4xl">
                {planet.name}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[#D8DEE9] drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">
                <Telescope className="h-3.5 w-3.5 text-[#88C0D0]" />
                {methodLabel(planet.discoveryMethod, t, t("planet.unknownMethod"))}
              </p>
              {planet.tags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {planet.tags.map((tg) => (
                    <span
                      key={tg}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold backdrop-blur-md ${
                        tg === "HWO Candidate"
                          ? "border border-[#A3BE8C]/30 bg-[#A3BE8C]/15 text-[#A3BE8C]"
                          : "border border-[#B48EAD]/30 bg-[#B48EAD]/15 text-[#B48EAD]"
                      }`}
                    >
                      <Tag className="h-3 w-3" />
                      {tg}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ───────── RIGHT 40% · telemetry HUD ───────── */}
          <div className="flex w-full flex-col border-l border-white/5 bg-gradient-to-b from-[#0a0e1a]/70 to-[#05070f]/40 pt-6 backdrop-blur-sm lg:h-screen lg:w-2/5 lg:pt-24">
            
            {/* AI Summary Panel */}
            <div className="px-5">
              <PlanetSummaryPanel planetId={planet.id} autoLoad={planet.hasCachedAiSummary ?? false} />
            </div>

            {/* Tabs */}
            <div className="shrink-0 px-5">
              <div className="flex gap-1 rounded-xl border border-white/10 bg-[#0d1322]/60 p-1">
                {TABS.map((tb) => {
                  const active = tab === tb.key;
                  const Icon = tb.icon;
                  return (
                    <button
                      key={tb.key}
                      onClick={() => setTab(tb.key)}
                      className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        active ? "text-[#05070f]" : "text-[#9aa7bd] hover:text-[#ECEFF4]"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="detail-tab-pill"
                          className="absolute inset-0 rounded-lg bg-[#88C0D0]"
                          transition={{ type: "spring", stiffness: 480, damping: 36 }}
                        />
                      )}
                      <span className="relative flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        {tb.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab content */}
            <div className="custom-scrollbar flex-1 overflow-y-auto px-5 pb-10 pt-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-5"
                >
                  {tab === "params" && <ParametersGrid planet={planet} />}
                  {tab === "ai" && (
                    <>
                      <UncertaintyPanel planetId={planet.id} autoLoad={planet.hasCachedUncertainty ?? false} />
                      <AskPanel exoplanetId={planet.id} />
                    </>
                  )}
                  {tab === "lit" && <LinkedPapers planetId={planet.id} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
