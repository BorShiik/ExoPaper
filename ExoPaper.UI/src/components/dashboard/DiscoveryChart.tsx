import { useEffect, useState } from "react";
import { getDiscoveryStats } from "../../api/exoplanets";
import type { DiscoveryStats } from "../../types";
import { useT } from "../../i18n/LanguageContext";
import { methodLabel } from "../../lib/utils";

const GLOW_COLORS = [
  { bg: "bg-[#88C0D0]", shadow: "shadow-[0_0_12px_rgba(136,192,208,0.8)]" },
  { bg: "bg-[#B48EAD]", shadow: "shadow-[0_0_12px_rgba(180,142,173,0.8)]" },
  { bg: "bg-[#A3BE8C]", shadow: "shadow-[0_0_12px_rgba(163,190,140,0.8)]" },
  { bg: "bg-[#EBCB8B]", shadow: "shadow-[0_0_12px_rgba(235,203,139,0.8)]" },
  { bg: "bg-[#D08770]", shadow: "shadow-[0_0_12px_rgba(208,135,112,0.8)]" },
  { bg: "bg-[#BF616A]", shadow: "shadow-[0_0_12px_rgba(191,97,106,0.8)]" },
];

export default function DiscoveryChart() {
  const t = useT();
  const [data, setData] = useState<DiscoveryStats[]>([]);

  useEffect(() => {
    getDiscoveryStats()
      .then((d) => setData(d.sort((a, b) => b.count - a.count)))
      .catch(console.error);
  }, []);

  const totalPlanets = data.reduce((sum, s) => sum + s.count, 0);
  const maxCount = data.length > 0 ? data[0].count : 1;
  const dominantMethod = data.length > 0 ? methodLabel(data[0].discoveryMethod, t, data[0].discoveryMethod) : "N/A";

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="mb-4 flex items-center gap-2 text-xs font-mono text-[#A3BE8C]">
        <div className="h-1.5 w-1.5 rounded-full bg-[#A3BE8C] animate-pulse" />
        <span>DOMINANT VECTOR: {dominantMethod.toUpperCase()}</span>
      </div>

      <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 pb-2">
        {data.map((stat, i) => {
          const colorStyle = GLOW_COLORS[i % GLOW_COLORS.length];
          const percent = totalPlanets > 0 ? ((stat.count / totalPlanets) * 100).toFixed(1) : "0.0";
          
          return (
            <div key={stat.discoveryMethod} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[#ECEFF4] group-hover:text-white transition-colors drop-shadow-md">
                  {methodLabel(stat.discoveryMethod, t, stat.discoveryMethod)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-white font-bold drop-shadow-md">
                    {stat.count.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-mono text-[#88C0D0]">
                    ({percent}%)
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-[#1e222a] border border-[#434C5E]/30 overflow-hidden">
                <div
                  className={`h-full rounded-full ${colorStyle.bg} ${colorStyle.shadow} transition-all duration-1000 ease-out`}
                  style={{
                    width: `${(stat.count / maxCount) * 100}%`,
                    transitionDelay: `${i * 100}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {data.length === 0 && (
        <p className="text-sm text-text-muted py-8 text-center font-mono animate-pulse">
          Awaiting Discovery Vectors...
        </p>
      )}
    </div>
  );
}
