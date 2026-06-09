import { useEffect, useState } from "react";
import { FileText, Calendar, BookOpen, User } from "lucide-react";
import { getPapersByExoplanet } from "../../api/papers";
import type { Paper } from "../../types";
import { useT } from "../../i18n/LanguageContext";

interface Props {
  planetId: string;
}

export default function LinkedPapers({ planetId }: Props) {
  const t = useT();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchPapers = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await getPapersByExoplanet(planetId);
        if (active) {
          setPapers(results);
        }
      } catch (e) {
        console.error(e);
        if (active) {
          setError(t("linked.error"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchPapers();
    return () => {
      active = false;
    };
  }, [planetId]);

  return (
    <div className="glass rounded-xl p-5 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-4 w-4 text-accent-blue" />
        <h3 className="text-sm font-semibold text-text-primary">
          {t("linked.title")}
        </h3>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse space-y-2 rounded-lg bg-space-850 p-4">
              <div className="h-4 bg-space-700 rounded w-2/3"></div>
              <div className="h-3 bg-space-700 rounded w-1/4"></div>
              <div className="h-3 bg-space-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-accent-red/10 border border-accent-red/20 px-4 py-3 text-xs text-accent-red">
          {error}
        </div>
      )}

      {!loading && !error && papers.length === 0 && (
        <p className="text-xs text-text-muted py-4 text-center">
          {t("linked.empty")}
        </p>
      )}

      {!loading && !error && papers.length > 0 && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          {papers.map((paper) => (
            <div
              key={paper.id}
              className="rounded-lg bg-space-800/40 p-4 border border-space-700/35 hover:border-accent-blue/30 hover:bg-space-800/60 transition-all group"
            >
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-text-muted group-hover:text-accent-blue transition-colors mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-text-primary group-hover:text-accent-blue transition-colors line-clamp-2 leading-snug">
                    {paper.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[10px] text-text-muted">
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
                  </div>
                  <p className="text-[11px] text-text-secondary mt-2 line-clamp-3 leading-relaxed whitespace-pre-line">
                    {paper.abstract}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
