import { useState } from "react";
import { Brain, AlertTriangle, Loader2 } from "lucide-react";
import { getUncertaintySummary } from "../../api/exoplanets";
import type { UncertaintySummary } from "../../types";
import { useT } from "../../i18n/LanguageContext";

interface Props {
  planetId: string;
}

export default function UncertaintyPanel({ planetId }: Props) {
  const t = useT();
  const [data, setData] = useState<UncertaintySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUncertaintySummary(planetId);
      setData(result);
    } catch (e) {
      setError(t("unc.error"));
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-xl p-5 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-accent-orange" />
          <h3 className="text-sm font-semibold text-text-primary">
            {t("unc.title")}
          </h3>
        </div>

        {!data && (
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-accent-orange/15 px-4 py-2 text-xs font-semibold text-accent-orange hover:bg-accent-orange/25 transition-all disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
            {loading ? t("unc.analyzing") : t("unc.analyze")}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-accent-red/10 border border-accent-red/20 px-4 py-3 text-xs text-accent-red">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="rounded-lg bg-space-800/60 p-4">
            <p className="text-[10px] font-medium text-accent-purple uppercase tracking-wider mb-2">
              {t("unc.aiAnalysis")}
            </p>
            <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
              {data.analysisSummary}
            </div>
          </div>

          {data.conflicts.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
                {t("unc.referenced", { count: data.conflicts.length })}
              </p>
              <div className="space-y-2">
                {data.conflicts.map((c) => (
                  <div
                    key={c.paperId}
                    className="rounded-lg bg-space-800/40 p-3 border-l-2 border-accent-orange/40"
                  >
                    <p className="text-xs font-semibold text-text-primary line-clamp-1">
                      {c.paperTitle}
                    </p>
                    <p className="text-[11px] text-text-muted mt-1 line-clamp-2">
                      {c.relevantText}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!data && !loading && !error && (
        <p className="text-xs text-text-muted py-4 text-center">
          {t("unc.hint")}
        </p>
      )}
    </div>
  );
}
