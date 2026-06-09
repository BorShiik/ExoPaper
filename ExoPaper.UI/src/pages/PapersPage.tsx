import { useState, useEffect } from "react";
import { Search, Calendar, User, Loader2, BookOpen, AlertCircle, X, ExternalLink } from "lucide-react";
import Header from "../components/layout/Header";
import { searchPapers, getPaperWithAuthors } from "../api/papers";
import type { Paper, PaperWithAuthors } from "../types";
import { shortId } from "../lib/utils";
import { useT } from "../i18n/LanguageContext";

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
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-space-950 text-text-primary">
      <Header title={t("page.papers")} />

      <div className="flex-1 p-4 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
        <section className="glass rounded-xl p-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("papers.searchPlaceholder")}
                className="w-full rounded-lg bg-space-900 border border-space-700/60 pl-10 pr-4 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-blue/50 focus:outline-none focus:ring-1 focus:ring-accent-blue/30 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-accent-blue px-5 py-2.5 text-xs font-semibold text-white hover:bg-accent-blue-hover hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              {t("search.button")}
            </button>
          </form>
        </section>

        {error && (
          <div className="rounded-lg bg-accent-red/10 border border-accent-red/20 px-4 py-3 text-xs text-accent-red flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {!loading && papers.length === 0 && (
            <div className="text-center py-12 rounded-xl bg-space-900/20 border border-dashed border-space-850">
              <BookOpen className="h-8 w-8 text-text-muted mx-auto mb-2" />
              <p className="text-xs text-text-muted">{t("papers.empty")}</p>
            </div>
          )}

          {papers.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {papers.map((paper) => (
                <div
                  key={paper.id}
                  onClick={() => setSelectedPaperId(paper.id)}
                  className="rounded-xl border border-space-800 bg-space-900/20 p-5 hover:bg-space-900/40 hover:border-accent-blue/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all cursor-pointer group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent-blue transition-colors leading-snug">
                        {paper.title}
                      </h3>
                      <span className="text-[10px] text-text-muted whitespace-nowrap bg-space-800 px-2 py-0.5 rounded border border-space-700/40">
                        {shortId(paper.id)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(paper.publishedDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {t("papers.authors", { count: paper.authorIds.length })}
                      </span>
                      {paper.isReviewed && (
                        <span className="rounded bg-accent-blue/10 border border-accent-blue/20 px-1 py-0.5 text-[8px] font-medium text-accent-blue uppercase">
                          {t("papers.reviewed")}
                        </span>
                      )}
                      {paper.exoplanetIds.length > 0 && (
                        <span className="rounded bg-accent-purple/10 border border-accent-purple/20 px-1 py-0.5 text-[8px] font-medium text-accent-purple uppercase">
                          {t("papers.linkedPlanets", { count: paper.exoplanetIds.length })}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">
                      {paper.abstract}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMore && papers.length > 0 && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-space-850 px-6 py-2 text-xs font-semibold hover:bg-space-800 transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                {t("papers.loadMore")}
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedPaperId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-xl border border-space-700 bg-space-900 p-6 shadow-2xl space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => {
                setSelectedPaperId(null);
                setDetails(null);
              }}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary rounded-lg p-1 hover:bg-space-800 transition-all"
            >
              <X className="h-4 w-4" />
            </button>

            {detailsLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
                <p className="text-xs text-text-muted">{t("papers.resolving")}</p>
              </div>
            )}

            {detailsError && (
              <div className="rounded-lg bg-accent-red/10 border border-accent-red/20 px-4 py-3 text-xs text-accent-red">
                {detailsError}
              </div>
            )}

            {!detailsLoading && !detailsError && details && (
              <div className="space-y-4">
                <div className="space-y-1 pr-6">
                  <span className="rounded bg-accent-blue/10 border border-accent-blue/20 px-2 py-0.5 text-[9px] font-semibold text-accent-blue uppercase tracking-wider">
                    {t("papers.detailsKicker")}
                  </span>
                  <h2 className="text-base font-bold text-text-primary leading-snug">
                    {details.paper.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-text-muted pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {t("papers.published")}: {new Date(details.paper.publishedDate).toLocaleDateString()}
                    </span>
                    <span>{t("papers.documentId")}: {details.paper.id}</span>
                  </div>
                </div>

                <hr className="border-space-800" />

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-text-primary">
                    {t("papers.authorsAffiliations")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {details.authors.length === 0 ? (
                      <span className="text-xs text-text-muted">{t("papers.noAuthors")}</span>
                    ) : (
                      details.authors.map((author) => (
                        <div
                          key={author.id}
                          className="rounded-lg bg-space-800/80 px-3 py-2 border border-space-700/50 flex flex-col gap-0.5 text-left"
                        >
                          <span className="text-xs font-semibold text-text-primary">{author.name}</span>
                          <span className="text-[10px] text-text-muted line-clamp-1">{author.affiliation || t("papers.unknownAffiliation")}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-text-primary">
                    {t("papers.abstract")}
                  </h3>
                  <div className="rounded-lg bg-space-950 p-4 border border-space-800">
                    <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {details.paper.abstract}
                    </p>
                  </div>
                </div>

                {details.paper.exoplanetIds.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-text-primary">
                      {t("papers.linkedExoplanets")}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {details.paper.exoplanetIds.map((eid) => {
                        const name = eid.replace("exoplanets/", "");
                        return (
                          <a
                            key={eid}
                            href={`/planet/${encodeURIComponent(name)}`}
                            onClick={(e) => {
                              e.preventDefault();
                              setSelectedPaperId(null);
                              setDetails(null);
                              window.location.hash = `#/planet/${encodeURIComponent(name)}`;
                              window.dispatchEvent(new HashChangeEvent("hashchange"));
                            }}
                            className="inline-flex items-center gap-1 rounded bg-accent-purple/10 border border-accent-purple/20 px-2 py-1 text-[10px] font-medium text-accent-purple hover:bg-accent-purple/20 transition-all"
                          >
                            <span>{name}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedPaperId(null);
                  setDetails(null);
                }}
                className="rounded-lg bg-space-800 px-4 py-2 text-xs font-semibold hover:bg-space-750 transition-colors"
              >
                {t("papers.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
