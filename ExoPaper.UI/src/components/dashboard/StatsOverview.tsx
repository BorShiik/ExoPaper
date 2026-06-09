import { useEffect, useState } from "react";
import { Globe, Star, Telescope, FileText } from "lucide-react";
import { getExoplanets, getHabitablePlanets, getDiscoveryStats } from "../../api/exoplanets";
import { useT } from "../../i18n/LanguageContext";
import type { TranslationKey } from "../../i18n/translations";

interface StatCard {
  labelKey: TranslationKey;
  value: number;
  icon: React.ReactNode;
  color: string;
  glowClass: string;
}

export default function StatsOverview() {
  const t = useT();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [, habitable, discoveryStats] = await Promise.all([
          getExoplanets({ take: 1 }),
          getHabitablePlanets(0, 1000),
          getDiscoveryStats(),
        ]);

        const totalPlanets = discoveryStats.reduce((sum, s) => sum + s.count, 0);
        const hwoCandidates = 0;

        setStats([
          {
            labelKey: "stats.exoplanets",
            value: totalPlanets,
            icon: <Globe className="h-5 w-5" />,
            color: "text-accent-blue",
            glowClass: "glow-blue",
          },
          {
            labelKey: "stats.habitable",
            value: habitable.length,
            icon: <Star className="h-5 w-5" />,
            color: "text-accent-green",
            glowClass: "glow-green",
          },
          {
            labelKey: "stats.methods",
            value: discoveryStats.length,
            icon: <Telescope className="h-5 w-5" />,
            color: "text-accent-purple",
            glowClass: "glow-purple",
          },
          {
            labelKey: "stats.hwo",
            value: hwoCandidates,
            icon: <FileText className="h-5 w-5" />,
            color: "text-accent-orange",
            glowClass: "",
          },
        ]);
      } catch (e) {
        console.error("Failed to load stats:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-5 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={stat.labelKey}
          className={`glass glass-hover rounded-xl p-5 transition-all duration-300 animate-fade-in-up ${stat.glowClass}`}
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              {t(stat.labelKey)}
            </span>
            <div className={stat.color}>{stat.icon}</div>
          </div>
          <p className={`mt-3 text-3xl font-bold tracking-tight ${stat.color} animate-count-up`}>
            {stat.value.toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
