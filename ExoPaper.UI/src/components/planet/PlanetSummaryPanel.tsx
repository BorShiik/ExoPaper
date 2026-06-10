import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Brain, Cpu, ChevronDown, RotateCcw,
  Globe2, Scale, Wind, Orbit, Star, BookOpen, HelpCircle,
  Zap, Languages
} from "lucide-react";
import { getPlanetSummary } from "../../api/exoplanets";
import type { PlanetAiSummaryResult } from "../../types";
import { useT, useLanguage } from "../../i18n/LanguageContext";
import type { TranslationKey } from "../../i18n/translations";
import { useTranslate } from "../../hooks/useTranslate";
import MarkdownText from "../ui/MarkdownText";

interface Props {
  planetId: string;
  autoLoad?: boolean;
}

const DIAG_LINES = [
  ">> [SYS] Initializing structured synthesis module...",
  ">> [DB]  Querying Papers_ByVector for linked literature...",
  ">> [LLM] llama3:8b · analyzing planetary characteristics...",
  ">> [LLM] Classifying planet type & habitability...",
  ">> [LLM] Building comparative context & highlights...",
  ">> [LLM] Structuring comprehensive planet profile...",
];

interface SectionDef {
  key: string;
  titleKey: TranslationKey;
  icon: typeof Globe2;
  accent: string;
  borderColor: string;
  field: keyof PlanetAiSummaryResult;
}

const SECTIONS: SectionDef[] = [
  { key: "highlights",    titleKey: "synthesis.highlights",    icon: Zap,       accent: "#EBCB8B", borderColor: "#EBCB8B", field: "keyHighlights" },
  { key: "habitability",  titleKey: "synthesis.habitability",  icon: Globe2,    accent: "#A3BE8C", borderColor: "#A3BE8C", field: "habitabilityAssessment" },
  { key: "comparative",   titleKey: "synthesis.comparative",   icon: Scale,     accent: "#88C0D0", borderColor: "#88C0D0", field: "comparativeContext" },
  { key: "atmosphere",    titleKey: "synthesis.atmosphere",     icon: Wind,      accent: "#81A1C1", borderColor: "#81A1C1", field: "atmosphereClimate" },
  { key: "orbital",       titleKey: "synthesis.orbital",        icon: Orbit,     accent: "#8FBCBB", borderColor: "#8FBCBB", field: "orbitalDynamics" },
  { key: "hostStar",      titleKey: "synthesis.hostStar",       icon: Star,      accent: "#D08770", borderColor: "#D08770", field: "hostStarAnalysis" },
  { key: "literature",    titleKey: "synthesis.literature",     icon: BookOpen,  accent: "#B48EAD", borderColor: "#B48EAD", field: "literatureSynthesis" },
  { key: "openQuestions", titleKey: "synthesis.openQuestions",  icon: HelpCircle,accent: "#5E81AC", borderColor: "#5E81AC", field: "openQuestions" },
];

/** Translatable text block — shows original while translation is pending. */
function TranslatedBlock({ text, className = "" }: { text: string; className?: string }) {
  const { translated, isTranslating } = useTranslate(text);
  return (
    <div className={`relative ${className}`}>
      {isTranslating && (
        <div className="absolute -top-1 right-0 flex items-center gap-1 text-[10px] text-[#88C0D0]/60">
          <Languages className="h-3 w-3 animate-pulse" />
        </div>
      )}
      <MarkdownText text={translated} />
    </div>
  );
}

export default function PlanetSummaryPanel({ planetId, autoLoad = false }: Props) {
  const t = useT();
  const { locale } = useLanguage();
  const [data, setData] = useState<PlanetAiSummaryResult | null>(null);
  // Translate the planet-type chip too (e.g. "Gas Giant" → "Gazowy olbrzym" in PL).
  const { translated: translatedPlanetType } = useTranslate(data?.planetType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const [step, setStep] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoLoadedFor = useRef<string | null>(null);

  // Boot-sequence animation during loading.
  useEffect(() => {
    if (!loading) { setStep(0); return; }
    timer.current = setInterval(() => {
      setStep((s) => (s < DIAG_LINES.length - 1 ? s + 1 : s));
    }, 800);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [loading]);

  const handleFetch = useCallback(async (regenerate = false) => {
    setLoading(true);
    setError(null);
    setData(null);
    setExpandedSections(new Set());
    try {
      const result = await getPlanetSummary(planetId, regenerate);
      setData(result);
      // Auto-expand first 3 non-empty sections.
      const firstSections = SECTIONS
        .filter((s) => {
          const val = result[s.field];
          return typeof val === "string" && val.trim().length > 0;
        })
        .slice(0, 3)
        .map((s) => s.key);
      setExpandedSections(new Set(firstSections));
    } catch (e) {
      setError(t("unc.error") || "Synthesis failed.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [planetId, t]);

  useEffect(() => {
    if (autoLoad && autoLoadedFor.current !== planetId) {
      autoLoadedFor.current = planetId;
      void handleFetch(false);
    }
  }, [autoLoad, planetId, handleFetch]);

  const availableSections = useMemo(() => {
    if (!data) return [];
    return SECTIONS.filter((s) => {
      const val = data[s.field];
      return typeof val === "string" && val.trim().length > 0;
    });
  }, [data]);

  const allExpanded = availableSections.every((s) => expandedSections.has(s.key));

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedSections(new Set());
    } else {
      setExpandedSections(new Set(availableSections.map((s) => s.key)));
    }
  };

  // ─── CTA state (no data yet) ─────────────────────────────────────────────
  if (!data && !loading && !error) {
    return (
      <div className="mb-6 rounded-2xl border border-white/10 bg-[#0d1322]/50 p-6 backdrop-blur-xl transition-all hover:border-white/20">
        <div className="flex flex-col items-center justify-center text-center">
          <Sparkles className="mb-3 h-8 w-8 text-[#88C0D0]" />
          <h3 className="mb-2 text-sm font-semibold text-[#ECEFF4]">{t("synthesis.title")}</h3>
          <p className="mb-4 text-xs text-[#9aa7bd] max-w-sm">
            {locale === "pl"
              ? "Wygeneruj kompleksowy profil AI tej egzoplanety na podstawie danych katalogowych i publikacji naukowych."
              : "Generate a comprehensive AI profile of this exoplanet based on catalog data and scientific publications."}
          </p>
          <button
            onClick={() => handleFetch(false)}
            className="group flex items-center gap-2 rounded-full border border-[#88C0D0]/30 bg-[#88C0D0]/10 px-5 py-2.5 text-xs font-semibold text-[#88C0D0] transition-all hover:bg-[#88C0D0]/20 hover:shadow-[0_0_18px_-4px_rgba(136,192,208,0.5)]"
          >
            <Brain className="h-4 w-4" />
            {t("synthesis.generate")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-0">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="rounded-t-2xl border border-white/10 bg-[#0d1322]/60 p-4 backdrop-blur-xl relative overflow-hidden">
        <div className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ boxShadow: 'inset 0 0 0 1px rgba(136,192,208,0.15)' }} />

        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#88C0D0]" />
            <h3 className="text-sm font-semibold text-[#ECEFF4] tracking-wide">
              {t("synthesis.title")}
            </h3>
            {data?.planetType && (
              <span className="ml-1 rounded-full bg-[#88C0D0]/15 border border-[#88C0D0]/30 px-2.5 py-0.5 text-[10px] font-semibold text-[#88C0D0]">
                {translatedPlanetType || data.planetType}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {data && availableSections.length > 1 && !loading && (
              <button
                onClick={toggleAll}
                className="text-[10px] font-semibold uppercase tracking-wider text-[#4c566a] transition-colors hover:text-[#88C0D0]"
              >
                {allExpanded ? t("synthesis.collapseAll") : t("synthesis.expandAll")}
              </button>
            )}
            {!loading && (
              <button
                onClick={() => handleFetch(true)}
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#4c566a] transition-colors hover:text-[#88C0D0]"
              >
                <RotateCcw className="h-3 w-3" />
                {t("synthesis.regenerate")}
              </button>
            )}
          </div>
        </div>

        {/* Short summary — always visible */}
        {data && !loading && (
          <div className="mt-3 text-sm leading-relaxed text-[#cdd6e6] relative z-10">
            <TranslatedBlock text={data.shortSummary} />
          </div>
        )}
      </div>

      {/* ─── Loading terminal ────────────────────────────────── */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-x border-white/10 bg-[#0d1322]/60"
          >
            <div className="p-4 font-mono text-[11px] leading-relaxed">
              <div className="mb-2 flex items-center gap-1.5 text-[#A3BE8C]">
                <Cpu className="h-3 w-3 animate-pulse" />
                <span className="uppercase tracking-wider">RAG · Planet Profile Synthesis</span>
              </div>
              {DIAG_LINES.slice(0, step + 1).map((line, i) => (
                <motion.p
                  key={line}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={i === step ? "text-[#88C0D0]" : "text-[#6b7689]"}
                >
                  {line}
                  {i === step && (
                    <span className="ml-1 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-[#88C0D0]" />
                  )}
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Error ───────────────────────────────────────────── */}
      {error && !loading && (
        <div className="border-x border-white/10 bg-[#0d1322]/60 px-4 py-3">
          <div className="rounded-xl border border-[#BF616A]/30 bg-[#BF616A]/10 px-4 py-3 text-xs text-[#d98b92]">
            {error}
          </div>
        </div>
      )}

      {/* ─── Accordion sections ──────────────────────────────── */}
      {data && !loading && (
        <div className="border-x border-b border-white/10 rounded-b-2xl bg-[#0d1322]/40 backdrop-blur-xl overflow-hidden divide-y divide-white/[0.04]">
          {availableSections.map((section) => {
            const isOpen = expandedSections.has(section.key);
            const Icon = section.icon;
            const content = data[section.field] as string;

            return (
              <div key={section.key} className="group/section">
                {/* Section header — clickable */}
                <button
                  onClick={() => toggleSection(section.key)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all"
                    style={{
                      backgroundColor: `${section.accent}15`,
                      borderLeft: `2px solid ${section.accent}60`,
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: section.accent }} />
                  </div>

                  <span className="flex-1 text-xs font-semibold text-[#ECEFF4] tracking-wide">
                    {t(section.titleKey)}
                  </span>

                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-4 w-4 text-[#4c566a] transition-colors group-hover/section:text-[#88C0D0]" />
                  </motion.div>
                </button>

                {/* Section body — animated reveal */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div
                        className="mx-4 mb-3 rounded-xl p-3.5 text-xs leading-relaxed text-[#cdd6e6]"
                        style={{
                          backgroundColor: `${section.accent}08`,
                          borderLeft: `2px solid ${section.accent}40`,
                        }}
                      >
                        <TranslatedBlock text={content} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
