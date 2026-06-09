import { useEffect, useState } from "react";
import { getDiscoveryStats } from "../../api/exoplanets";
import type { DiscoveryStats } from "../../types";
import { useT } from "../../i18n/LanguageContext";
import { methodLabel } from "../../lib/utils";

const COLORS = [
  "bg-accent-blue",
  "bg-accent-purple",
  "bg-accent-cyan",
  "bg-accent-green",
  "bg-accent-orange",
  "bg-accent-red",
  "bg-space-500",
];

export default function DiscoveryChart() {
  const t = useT();
  const [data, setData] = useState<DiscoveryStats[]>([]);

  useEffect(() => {
    getDiscoveryStats()
      .then((d) => setData(d.sort((a, b) => b.count - a.count)))
      .catch(console.error);
  }, []);

  const maxCount = data.length > 0 ? data[0].count : 1;

  return (
    <div className="glass rounded-xl p-5 animate-fade-in-up">
      <h3 className="text-sm font-semibold text-text-primary mb-4">
        {t("chart.title")}
      </h3>

      <div className="space-y-3">
        {data.map((stat, i) => (
          <div key={stat.discoveryMethod} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                {methodLabel(stat.discoveryMethod, t, stat.discoveryMethod)}
              </span>
              <span className="text-xs font-mono text-text-muted">
                {stat.count.toLocaleString()}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-space-700 overflow-hidden">
              <div
                className={`h-full rounded-full ${COLORS[i % COLORS.length]} transition-all duration-700 ease-out`}
                style={{
                  width: `${(stat.count / maxCount) * 100}%`,
                  transitionDelay: `${i * 100}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <p className="text-sm text-text-muted py-8 text-center">
          {t("chart.empty")}
        </p>
      )}
    </div>
  );
}
