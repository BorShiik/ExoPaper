import { useEffect, useState } from "react";
import { Globe, Star, Telescope, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { getExoplanets, getHabitablePlanets, getDiscoveryStats, getHwoCandidateCount } from "../../api/exoplanets";
import { useT } from "../../i18n/LanguageContext";
import type { TranslationKey } from "../../i18n/translations";

interface StatCard {
  labelKey: TranslationKey;
  value: number;
  icon: React.ReactNode;
  color: string;
  glowClass: string;
  dotColor: string;
  subText: React.ReactNode;
}

export default function StatsOverview() {
  const t = useT();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [, habitable, discoveryStats, hwoCandidates] = await Promise.all([
          getExoplanets({ take: 1 }),
          getHabitablePlanets(0, 1000),
          getDiscoveryStats(),
          getHwoCandidateCount(),
        ]);

        const totalPlanets = discoveryStats.reduce((sum, s) => sum + s.count, 0);
        const habPercent = totalPlanets > 0 ? ((habitable.length / totalPlanets) * 100).toFixed(1) : "0.0";

        setStats([
          {
            labelKey: "stats.exoplanets",
            value: totalPlanets,
            icon: <Globe className="h-5 w-5" />,
            color: "text-accent-blue",
            glowClass: "glow-blue",
            dotColor: "bg-accent-blue",
            subText: "[Map-Reduce Statistics: Online]"
          },
          {
            labelKey: "stats.habitable",
            value: habitable.length,
            icon: <Star className="h-5 w-5" />,
            color: "text-accent-green",
            glowClass: "glow-green",
            dotColor: "bg-accent-green",
            subText: (
              <div className="w-full mt-1">
                <div className="flex justify-between text-[10px] mb-1 font-mono text-slate-400">
                  <span>{habPercent}% of total exoplanets</span>
                </div>
                <div className="h-1 w-full bg-[#1e222a] rounded-full overflow-hidden">
                  <div className="h-full bg-accent-green" style={{ width: `${Math.min(parseFloat(habPercent), 100)}%` }} />
                </div>
              </div>
            )
          },
          {
            labelKey: "stats.methods",
            value: discoveryStats.length,
            icon: <Telescope className="h-5 w-5" />,
            color: "text-accent-purple",
            glowClass: "glow-purple",
            dotColor: "bg-accent-purple",
            subText: "[Spectroscopy Systems Active]"
          },
          {
            labelKey: "stats.hwo",
            value: hwoCandidates,
            icon: <FileText className="h-5 w-5" />,
            color: "text-accent-orange",
            glowClass: "",
            dotColor: "bg-accent-orange",
            subText: "[TaggingWorker Active]"
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
          <div key={i} className="glass rounded-xl p-5 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 100 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
  };

  return (
    <motion.div 
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 w-full"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ amount: 0.3, once: true }}
    >
      {stats.map((stat) => (
        <motion.div
          key={stat.labelKey}
          variants={itemVariants}
          className={`glass glass-hover rounded-xl p-5 transition-colors duration-300 flex flex-col justify-between ${stat.glowClass}`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${stat.dotColor} animate-pulse`} />
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t(stat.labelKey)}
                </span>
              </div>
              <div className={stat.color}>{stat.icon}</div>
            </div>
            <p className={`mt-3 text-3xl font-bold tracking-tight ${stat.color} animate-count-up`}>
              {stat.value.toLocaleString()}
            </p>
          </div>
          <div className="mt-3 text-xs text-slate-400 font-mono">
            {stat.subText}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
