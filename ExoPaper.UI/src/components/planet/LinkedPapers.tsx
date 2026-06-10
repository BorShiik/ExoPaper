import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Calendar, BookOpen, User, ExternalLink, Search, Loader2 } from "lucide-react";
import { getPapersByExoplanet } from "../../api/papers";
import { harvestPapersForPlanet } from "../../api/exoplanets";
import type { Paper } from "../../types";
import { useT } from "../../i18n/LanguageContext";
import { arxivUrl, extractArxivId } from "../../lib/utils";
import MarkdownText from "../ui/MarkdownText";

interface Props {
  planetId: string;
}



export default function LinkedPapers({ planetId }: Props) {
  const t = useT();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [harvesting, setHarvesting] = useState(false);
  const [harvestMsg, setHarvestMsg] = useState<string | null>(null);

  const loadPapers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await getPapersByExoplanet(planetId);
      setPapers(results);
    } catch (e) {
      console.error(e);
      setError(t("linked.error"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planetId]);

  const runHarvest = useCallback(async () => {
    setHarvesting(true);
    setHarvestMsg(null);
    try {
      const result = await harvestPapersForPlanet(planetId);
      setHarvestMsg(result.message);
      await loadPapers();
    } catch (e) {
      console.error(e);
      setHarvestMsg(t("linked.error"));
    } finally {
      setHarvesting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planetId, loadPapers]);

  useEffect(() => {
    void loadPapers();
  }, [loadPapers]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#2E3440]/30 backdrop-blur-xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-[#88C0D0]" />
        <h3 className="text-sm font-semibold text-[#ECEFF4] drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">
          {t("linked.title")}
        </h3>
        {!loading && papers.length > 0 && (
          <span className="rounded-full bg-[#81A1C1]/15 px-2 py-0.5 font-mono text-[10px] text-[#81A1C1]">
            {papers.length}
          </span>
        )}
        <button
          onClick={runHarvest}
          disabled={harvesting}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#88C0D0]/30 bg-[#88C0D0]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#88C0D0] transition-all hover:bg-[#88C0D0]/20 disabled:opacity-50"
        >
          {harvesting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Search className="h-3 w-3" />
          )}
          {harvesting ? t("linked.harvesting") : t("linked.harvest")}
        </button>
      </div>

      {harvestMsg && (
        <div className="mb-3 rounded-lg border border-[#81A1C1]/20 bg-[#81A1C1]/10 px-3 py-2 text-[11px] text-[#9aa7bd]">
          {harvestMsg}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-[#0d1322]/50 p-4">
              <div className="h-3.5 w-2/3 rounded animate-shimmer-aurora" />
              <div className="mt-2 h-2.5 w-1/4 rounded animate-shimmer-aurora" />
              <div className="mt-3 h-2.5 w-full rounded animate-shimmer-aurora" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[#BF616A]/30 bg-[#BF616A]/10 px-4 py-3 text-xs text-[#d98b92]">
          {error}
        </div>
      )}

      {!loading && !error && papers.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
          <FileText className="mx-auto mb-2 h-7 w-7 text-[#4c566a]" />
          <p className="mb-4 text-xs text-[#9aa7bd]">{t("linked.empty")}</p>
          <button
            onClick={runHarvest}
            disabled={harvesting}
            className="mx-auto flex items-center gap-2 rounded-full border border-[#88C0D0]/30 bg-[#88C0D0]/10 px-5 py-2 text-xs font-semibold text-[#88C0D0] transition-all hover:bg-[#88C0D0]/20 disabled:opacity-50"
          >
            {harvesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {harvesting ? t("linked.harvesting") : t("linked.harvest")}
          </button>
        </div>
      )}

      {!loading && !error && papers.length > 0 && (
        <div className="custom-scrollbar max-h-[460px] space-y-3 overflow-y-auto pr-1">
          {papers.map((paper, i) => (
            <motion.div
              key={paper.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.06, 0.5), ease: [0.16, 1, 0.3, 1] }}
              className="group block rounded-xl border border-white/[0.07] bg-[#0d1322]/50 p-4 transition-all hover:border-[#88C0D0]/40 hover:bg-[#0d1322]/75"
            >
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#7a869c] transition-colors group-hover:text-[#88C0D0]" />
                <div className="min-w-0 space-y-1.5 w-full">
                  <h4 className="line-clamp-2 text-xs font-semibold leading-snug text-[#ECEFF4] transition-colors group-hover:text-white">
                    {paper.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#7a869c]">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(paper.publishedDate).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {t("papers.authors", { count: paper.authorIds.length })}
                    </span>
                    {paper.isReviewed && (
                      <span className="rounded border border-[#81A1C1]/25 bg-[#81A1C1]/10 px-1.5 py-0.5 text-[8px] font-medium uppercase text-[#81A1C1]">
                        {t("papers.reviewed")}
                      </span>
                    )}
                  </div>
                  <div className="line-clamp-3 text-[11px] leading-relaxed text-[#9aa7bd] font-medium">
                    <MarkdownText text={paper.abstract} />
                  </div>
                  <div className="mt-2 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#88C0D0]">
                      arXiv:{extractArxivId(paper.id)}
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={arxivUrl(paper.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded p-1.5 text-[#7a869c] hover:bg-white/10 hover:text-[#ECEFF4] transition-colors"
                        title="Read HTML"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={`https://arxiv.org/pdf/${paper.id.replace('papers/', '')}.pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded p-1.5 text-[#7a869c] hover:bg-[#BF616A]/20 hover:text-[#BF616A] transition-colors"
                        title="Download PDF"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
