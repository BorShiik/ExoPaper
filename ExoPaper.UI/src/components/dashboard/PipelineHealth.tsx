import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Globe, FileText } from "lucide-react";
import { getSystemHealth, type SystemHealth } from "../../api/sync";
import { useT } from "../../i18n/LanguageContext";

function CoverageBar({ label, percent }: { label: string; percent: number }) {
  const color = percent >= 70 ? "#A3BE8C" : percent >= 40 ? "#EBCB8B" : "#BF616A";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-medium uppercase tracking-wider text-text-muted">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>
          {percent}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1e222a]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}88` }}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0d1322]/70 text-[#88C0D0]">
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
        <p className="font-mono text-xl font-bold text-text-primary">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

export default function PipelineHealth() {
  const t = useT();
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    let active = true;
    getSystemHealth()
      .then((h) => active && setHealth(h))
      .catch((e) => console.error(e));
    return () => {
      active = false;
    };
  }, []);

  if (!health) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.3, once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="glass glass-hover glow-blue rounded-xl p-5"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#88C0D0] animate-pulse" />
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {t("health.title")}
        </span>
        <Activity className="ml-auto h-5 w-5 text-[#88C0D0]" />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex items-center justify-around gap-4 md:justify-start md:gap-8">
          <Stat icon={<Globe className="h-4 w-4" />} label={t("health.planets")} value={health.totalPlanets} />
          <Stat icon={<FileText className="h-4 w-4" />} label={t("health.papers")} value={health.totalPapers} />
        </div>
        <div className="flex flex-col justify-center gap-3">
          <CoverageBar label={t("health.embedded")} percent={health.embeddingCoveragePercent} />
          <CoverageBar label={t("health.linked")} percent={health.linkingCoveragePercent} />
        </div>
      </div>
    </motion.div>
  );
}
