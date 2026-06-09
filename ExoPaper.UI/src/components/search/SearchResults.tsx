import { useNavigate } from "react-router-dom";
import { FileText, Orbit, Calendar } from "lucide-react";
import type { PaperSearchHit } from "../../types";
import { shortId } from "../../lib/utils";
import { useT } from "../../i18n/LanguageContext";

interface Props {
  results: PaperSearchHit[];
  loading: boolean;
}

export default function SearchResults({ results, loading }: Props) {
  const navigate = useNavigate();
  const t = useT();

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-5 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <FileText className="h-8 w-8 text-text-muted mx-auto mb-3" />
        <p className="text-sm text-text-muted">{t("search.none")}</p>
        <p className="text-xs text-text-muted mt-1">{t("search.noneHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted font-medium">
        {t("search.found", { count: results.length })}
      </p>

      {results.map((hit, i) => (
        <div
          key={hit.id}
          className="glass glass-hover rounded-xl p-5 cursor-pointer transition-all duration-200 animate-fade-in-up"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-text-primary line-clamp-1 mb-1">
                {hit.title}
              </h4>
              <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">
                {hit.abstract}
              </p>
            </div>

            <div className="flex items-center gap-1 text-text-muted shrink-0">
              <Calendar className="h-3 w-3" />
              <span className="text-[10px] font-mono">
                {new Date(hit.publishedDate).toLocaleDateString()}
              </span>
            </div>
          </div>

          {hit.exoplanetIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {hit.exoplanetIds.slice(0, 5).map((pid) => (
                <button
                  key={pid}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/planet/${encodeURIComponent(shortId(pid))}`);
                  }}
                  className="flex items-center gap-1 rounded-full bg-accent-blue/10 px-2.5 py-0.5 text-[10px] font-medium text-accent-blue hover:bg-accent-blue/20 transition-colors"
                >
                  <Orbit className="h-2.5 w-2.5" />
                  {shortId(pid)}
                </button>
              ))}
              {hit.exoplanetIds.length > 5 && (
                <span className="text-[10px] text-text-muted self-center">
                  {t("search.more", { count: hit.exoplanetIds.length - 5 })}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
