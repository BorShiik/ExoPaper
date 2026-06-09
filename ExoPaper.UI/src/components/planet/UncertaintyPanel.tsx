import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, AlertTriangle, Cpu, RotateCcw } from "lucide-react";
import { getUncertaintySummary } from "../../api/exoplanets";
import type { UncertaintySummary } from "../../types";
import { useT } from "../../i18n/LanguageContext";

interface Props {
  planetId: string;
  /** When true, a cached analysis exists — load it immediately (no LLM call). */
  autoLoad?: boolean;
}

/** Boot-sequence lines streamed while the local LLM (llama3:8b) is thinking. */
const DIAG_LINES = [
  ">> [SYS] Initiating semantic mapping…",
  ">> [DB]  Querying RavenDB vector index · Papers_ByVector…",
  ">> [RAG] Retrieving contrasting passages across publications…",
  ">> [LLM] llama3:8b · analyzing conflicting measurements…",
  ">> [LLM] Cross-referencing mass / radius / eccentricity estimates…",
  ">> [LLM] Synthesizing empirical discrepancy report…",
];

/** Highlights contradiction language: Aurora-yellow for conflicts, red for strong discrepancies. */
function highlight(text: string): ReactNode[] {
  const re =
    /\b(significantly|significant|substantial|strong|large|severe|major)\b|\b(conflicts?|conflicting|discrepanc\w*|contradict\w*|disagree\w*|inconsistent|tensions?|uncertain\w*|differ\w*)\b/gi;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const high = !!m[1];
    out.push(
      <span
        key={k++}
        className={
          high
            ? "rounded bg-[#BF616A]/15 px-1 font-semibold text-[#d98b92]"
            : "rounded bg-[#EBCB8B]/15 px-1 font-medium text-[#EBCB8B]"
        }
      >
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function UncertaintyPanel({ planetId, autoLoad = false }: Props) {
  const t = useT();
  const [data, setData] = useState<UncertaintySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoLoadedFor = useRef<string | null>(null);

  // Stream the diagnostic lines while the request is in flight.
  useEffect(() => {
    if (!loading) {
      setStep(0);
      return;
    }
    timer.current = setInterval(() => {
      setStep((s) => (s < DIAG_LINES.length - 1 ? s + 1 : s));
    }, 700);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [loading]);

  const handleAnalyze = async (regenerate = false) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await getUncertaintySummary(planetId, regenerate);
      setData(result);
    } catch (e) {
      setError(t("unc.error"));
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // If a cached analysis already exists, fetch it on mount — the backend returns
  // it instantly without touching the LLM. Never auto-triggers a fresh analysis.
  useEffect(() => {
    if (autoLoad && autoLoadedFor.current !== planetId) {
      autoLoadedFor.current = planetId;
      void handleAnalyze(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, planetId]);

  const conflictCount = data?.conflicts.length ?? 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#2E3440]/30 backdrop-blur-xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#EBCB8B]" />
          <h3 className="text-sm font-semibold text-[#ECEFF4] drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">
            {t("unc.title")}
          </h3>
        </div>

        {!loading && (
          <button
            onClick={() => handleAnalyze(!!data)}
            title={data ? "Regenerate (re-run llama3)" : undefined}
            className="group flex items-center gap-2 rounded-lg border border-[#EBCB8B]/30 bg-[#EBCB8B]/10 px-4 py-2 text-xs font-semibold text-[#EBCB8B] transition-all hover:bg-[#EBCB8B]/20 hover:shadow-[0_0_18px_-4px_rgba(235,203,139,0.6)]"
          >
            {data ? <RotateCcw className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5" />}
            {t("unc.analyze")}
          </button>
        )}
      </div>

      {/* Loading: high-tech diagnostics terminal */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-[#A3BE8C]/20 bg-[#070b14]/80 p-4 font-mono text-[11px] leading-relaxed">
              <div className="mb-2 flex items-center gap-1.5 text-[#A3BE8C]">
                <Cpu className="h-3 w-3 animate-pulse" />
                <span className="uppercase tracking-wider">RAG · uncertainty terminal</span>
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

      {error && !loading && (
        <div className="rounded-xl border border-[#BF616A]/30 bg-[#BF616A]/10 px-4 py-3 text-xs text-[#d98b92]">
          {error}
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#B48EAD]/20 bg-[#0d1322]/60 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[#B48EAD]">
              <Brain className="h-3 w-3" />
              {t("unc.aiAnalysis")}
            </p>
            <div className="whitespace-pre-wrap text-xs leading-relaxed text-[#cdd6e6]">
              {highlight(data.analysisSummary)}
            </div>
          </div>

          {conflictCount > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[#7a869c]">
                {t("unc.referenced", { count: conflictCount })}
              </p>
              <div className="space-y-2">
                {data.conflicts.map((c) => (
                  <div
                    key={c.paperId}
                    className="rounded-xl border border-white/[0.06] border-l-2 border-l-[#EBCB8B]/60 bg-[#0d1322]/50 p-3"
                  >
                    <p className="line-clamp-1 text-xs font-semibold text-[#ECEFF4]">{c.paperTitle}</p>
                    <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-[#9aa7bd]">
                      {highlight(c.relevantText)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!data && !loading && !error && (
        <p className="py-4 text-center text-xs text-[#9aa7bd]">{t("unc.hint")}</p>
      )}
    </div>
  );
}
