import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Calendar,
  User,
  Loader2,
  BookOpen,
  AlertCircle,
  X,
  ExternalLink,
  FileText,
  Sparkles,
  Hash,
  ArrowUpRight,
} from "lucide-react";
import Header from "../components/layout/Header";
import { searchPapers, getPaperWithAuthors } from "../api/papers";
import type { Paper, PaperWithAuthors } from "../types";
import { shortId } from "../lib/utils";
import { useT } from "../i18n/LanguageContext";

const SUGGESTIONS = [
  "atmospheric biosignatures",
  "transit depth",
  "direct imaging",
  "radial velocity",
  "protoplanetary disk",
];

export default function PapersPage() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [skip, setSkip] = useState(0);
  const take = 10;
  const [hasMore, setHasMore] = useState(true);

  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [details, setDetails] = useState<PaperWithAuthors | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const fetchPapers = async (searchQuery: string, currentSkip: number, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const results = await searchPapers(searchQuery, currentSkip, take);
      if (append) {
        setPapers((prev) => [...prev, ...results]);
      } else {
        setPapers(results);
      }
      setHasMore(results.length === take);
    } catch (e) {
      console.error(e);
      setError(t("papers.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSkip(0);
    fetchPapers(query, 0, false);
  };

  const runSuggestion = (term: string) => {
    setQuery(term);
    setSkip(0);
    fetchPapers(term, 0, false);
  };

  const handleLoadMore = () => {
    const nextSkip = skip + take;
    setSkip(nextSkip);
    fetchPapers(query, nextSkip, true);
  };

  useEffect(() => {
    if (!selectedPaperId) return;

    let active = true;
    const fetchDetails = async () => {
      await Promise.resolve();
      if (!active) return;

      setDetailsLoading(true);
      setDetailsError(null);
      try {
        const data = await getPaperWithAuthors(selectedPaperId);
        if (active) {
          setDetails(data);
        }
      } catch (e) {
        console.error(e);
        if (active) {
          setDetailsError(t("papers.detailsError"));
        }
      } finally {
        if (active) {
          setDetailsLoading(false);
        }
      }
    };

    fetchDetails();
    return () => {
      active = false;
    };
  }, [selectedPaperId, t]);

  useEffect(() => {
    let active = true;
    const initFetch = async () => {
      await Promise.resolve();
      if (active) {
        fetchPapers("", 0, false);
      }
    };
    initFetch();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = () => {
    setSelectedPaperId(null);
    setDetails(null);
  };

  return (
    <div className="relative min-h-screen pointer-events-auto text-[#E5E9F0]">
      <Header title={t("page.papers")} />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-16 pt-24 sm:px-6 lg:pl-28">
        {/* Title strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#B48EAD]/25 bg-[#B48EAD]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#B48EAD]">
            <Sparkles className="h-3 w-3" />
            {t("page.papers")}
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#ECEFF4] sm:text-4xl">
            <span className="bg-gradient-to-r from-[#ECEFF4] via-[#B48EAD] to-[#81A1C1] bg-clip-text text-transparent">
              {t("page.papers")}
            </span>
          </h1>
        </motion.div>

        {/* Search */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="mb-4 rounded-2xl border border-white/10 bg-[#0d1322]/55 p-4 backdrop-blur-xl"
        >
          <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a869c]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("papers.searchPlaceholder")}
                className="w-full rounded-xl border border-white/10 bg-[#070b14]/70 py-2.5 pl-11 pr-4 text-sm text-[#ECEFF4] placeholder:text-[#5b6678] transition-all focus:border-[#B48EAD]/50 focus:outline-none focus:ring-2 focus:ring-[#B48EAD]/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="group inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#5E81AC] to-[#81A1C1] px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-[0_0_22px_-4px_rgba(129,161,193,0.7)] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {t("search.button")}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[#5b6678]">{t("search.filters")}</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => runSuggestion(s)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-[#9aa7bd] transition-all hover:border-[#B48EAD]/40 hover:text-[#ECEFF4]"
              >
                {s}
              </button>
            ))}
          </div>
        </motion.section>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#BF616A]/30 bg-[#BF616A]/10 px-4 py-3 text-xs text-[#d98b92]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty */}
        {!loading && papers.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1322]/40 py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-[#4c566a]" />
            <p className="text-sm text-[#9aa7bd]">{t("papers.empty")}</p>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && papers.length === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.06] bg-[#0d1322]/50 p-5">
                <div className="h-4 w-3/4 rounded animate-shimmer-aurora" />
                <div className="mt-3 h-2.5 w-1/3 rounded animate-shimmer-aurora" />
                <div className="mt-3 space-y-1.5">
                  <div className="h-2.5 w-full rounded animate-shimmer-aurora" />
                  <div className="h-2.5 w-5/6 rounded animate-shimmer-aurora" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {papers.map((paper, i) => (
              <motion.button
                key={paper.id}
                type="button"
                onClick={() => setSelectedPaperId(paper.id)}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ scale: 1.005 }}
                className="group relative block w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1322]/55 p-5 text-left backdrop-blur-xl transition-colors hover:border-[#81A1C1]/40"
              >
                <span className="absolute left-0 top-0 h-full w-[3px] origin-top scale-y-0 bg-gradient-to-b from-[#B48EAD] to-[#81A1C1] transition-transform duration-300 group-hover:scale-y-100" />
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-[15px] font-semibold leading-snug text-[#ECEFF4] transition-colors group-hover:text-white">
                    {paper.title}
                  </h3>
                  <span className="flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-[#7a869c]">
                    <Hash className="h-2.5 w-2.5" />
                    {shortId(paper.id)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[#7a869c]">
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
                  {paper.exoplanetIds.length > 0 && (
                    <span className="rounded border border-[#B48EAD]/25 bg-[#B48EAD]/10 px-1.5 py-0.5 text-[8px] font-medium uppercase text-[#B48EAD]">
                      {t("papers.linkedPlanets", { count: paper.exoplanetIds.length })}
                    </span>
                  )}
                </div>

                <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-[#9aa7bd]">
                  {paper.abstract}
                </p>

                <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-[#81A1C1] opacity-0 transition-opacity group-hover:opacity-100">
                  {t("papers.detailsKicker")}
                  <ArrowUpRight className="h-3 w-3" />
                </span>
              </motion.button>
            ))}
          </AnimatePresence>

          {hasMore && papers.length > 0 && (
            <div className="flex justify-center pt-6">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1322]/70 px-7 py-2.5 text-xs font-semibold text-[#ECEFF4] backdrop-blur-xl transition-all hover:border-[#81A1C1]/50 hover:shadow-[0_0_24px_-6px_rgba(129,161,193,0.5)] disabled:opacity-50"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#81A1C1]" />}
                {t("papers.loadMore")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedPaperId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeModal}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0b101c]/95 p-6 shadow-2xl custom-scrollbar"
            >
              <button
                onClick={closeModal}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-[#7a869c] transition-all hover:bg-white/5 hover:text-[#ECEFF4]"
              >
                <X className="h-4 w-4" />
              </button>

              {detailsLoading && (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#81A1C1]" />
                  <p className="text-xs text-[#9aa7bd]">{t("papers.resolving")}</p>
                </div>
              )}

              {detailsError && (
                <div className="rounded-xl border border-[#BF616A]/30 bg-[#BF616A]/10 px-4 py-3 text-xs text-[#d98b92]">
                  {detailsError}
                </div>
              )}

              {!detailsLoading && !detailsError && details && (
                <div className="space-y-5">
                  <div className="space-y-2 pr-6">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#81A1C1]/25 bg-[#81A1C1]/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#81A1C1]">
                      <FileText className="h-2.5 w-2.5" />
                      {t("papers.detailsKicker")}
                    </span>
                    <h2 className="text-lg font-bold leading-snug text-[#ECEFF4]">
                      {details.paper.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-[#7a869c]">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {t("papers.published")}: {new Date(details.paper.publishedDate).toLocaleDateString()}
                      </span>
                      <span className="font-mono">{t("papers.documentId")}: {details.paper.id}</span>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent" />

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-[#ECEFF4]">{t("papers.authorsAffiliations")}</h3>
                    <div className="flex flex-wrap gap-2">
                      {details.authors.length === 0 ? (
                        <span className="text-xs text-[#7a869c]">{t("papers.noAuthors")}</span>
                      ) : (
                        details.authors.map((author) => (
                          <div
                            key={author.id}
                            className="flex flex-col gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-left"
                          >
                            <span className="text-xs font-semibold text-[#ECEFF4]">{author.name}</span>
                            <span className="line-clamp-1 text-[10px] text-[#7a869c]">
                              {author.affiliation || t("papers.unknownAffiliation")}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-[#ECEFF4]">{t("papers.abstract")}</h3>
                    <div className="rounded-xl border border-white/[0.07] bg-[#070b14]/70 p-4">
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#9aa7bd]">
                        {details.paper.abstract}
                      </p>
                    </div>
                  </div>

                  {details.paper.exoplanetIds.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-[#ECEFF4]">{t("papers.linkedExoplanets")}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {details.paper.exoplanetIds.map((eid) => {
                          const name = eid.replace("exoplanets/", "");
                          return (
                            <a
                              key={eid}
                              href={`/planet/${encodeURIComponent(name)}`}
                              onClick={(e) => {
                                e.preventDefault();
                                closeModal();
                                window.location.hash = `#/planet/${encodeURIComponent(name)}`;
                                window.dispatchEvent(new HashChangeEvent("hashchange"));
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#B48EAD]/25 bg-[#B48EAD]/10 px-2 py-1 text-[10px] font-medium text-[#B48EAD] transition-all hover:bg-[#B48EAD]/20"
                            >
                              <span>{name}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-[#ECEFF4] transition-colors hover:bg-white/[0.08]"
                    >
                      {t("papers.close")}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
