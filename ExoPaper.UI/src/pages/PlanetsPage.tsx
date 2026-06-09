import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe2, Loader2, Box, Search } from "lucide-react";
import Header from "../components/layout/Header";
import { getExoplanets } from "../api/exoplanets";
import type { Exoplanet } from "../types";
import { shortId, methodLabel, formatValue } from "../lib/utils";
import { useT } from "../i18n/LanguageContext";

const PAGE = 24;

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-space-800/50 px-2.5 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className="font-mono text-text-primary">{value}</p>
    </div>
  );
}

export default function PlanetsPage() {
  const t = useT();
  const navigate = useNavigate();

  const [planets, setPlanets] = useState<Exoplanet[]>([]);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [method, setMethod] = useState("");
  const [nameFilter, setNameFilter] = useState("");

  const fetchPage = async (currentSkip: number, append: boolean, discoveryMethod: string) => {
    setLoading(true);
    try {
      const data = await getExoplanets({
        discoveryMethod: discoveryMethod || undefined,
        skip: currentSkip,
        take: PAGE,
        sortBy: "orbitalPeriod",
      });
      setPlanets((prev) => (append ? [...prev, ...data] : data));
      setHasMore(data.length === PAGE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSkip(0);
    fetchPage(0, false, method);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const loadMore = () => {
    const next = skip + PAGE;
    setSkip(next);
    fetchPage(next, true, method);
  };

  const visible = planets.filter((p) =>
    p.name.toLowerCase().includes(nameFilter.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-space-950 text-text-primary">
      <Header title={t("page.planets")} />

      <div className="flex-1 p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
        <section className="glass rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder={t("planets.namePlaceholder")}
              className="w-full rounded-lg bg-space-900 border border-space-700/60 pl-10 pr-4 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-blue/50 focus:outline-none focus:ring-1 focus:ring-accent-blue/30 transition-all"
            />
          </div>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="rounded-lg border border-border bg-space-800 px-3 py-2.5 text-xs text-text-primary outline-none focus:border-accent-blue transition-colors"
          >
            <option value="">{t("search.any")}</option>
            <option value="Transit">{t("method.transit")}</option>
            <option value="Radial Velocity">{t("method.radialVelocity")}</option>
            <option value="Microlensing">{t("method.microlensing")}</option>
            <option value="Direct Imaging">{t("method.directImaging")}</option>
            <option value="Transit Timing Variations">{t("method.ttv")}</option>
          </select>
        </section>

        {!loading && visible.length === 0 && (
          <div className="text-center py-12 rounded-xl bg-space-900/20 border border-dashed border-space-850">
            <Globe2 className="h-8 w-8 text-text-muted mx-auto mb-2" />
            <p className="text-xs text-text-muted">{t("planets.empty")}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/planet/${encodeURIComponent(shortId(p.id))}`)}
              className="group text-left rounded-xl border border-space-800 bg-space-900/30 p-5 hover:border-accent-blue/40 hover:bg-space-900/50 hover:shadow-[0_4px_24px_rgba(0,0,0,0.35)] transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent-blue transition-colors">
                  {p.name}
                </h3>
                <Box className="h-4 w-4 text-text-muted group-hover:text-accent-blue transition-colors shrink-0" />
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                {methodLabel(p.discoveryMethod, t, t("planet.unknownMethod"))}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <Param label={t("param.radius")} value={formatValue(p.radiusEarth, 2, "R⊕")} />
                <Param label={t("param.mass")} value={formatValue(p.massEarth, 2, "M⊕")} />
                <Param label={t("param.period")} value={formatValue(p.orbitalPeriodDays, 1, t("param.days"))} />
                <Param label={t("param.distance")} value={formatValue(p.distanceParsecs, 1, "pc")} />
              </div>

              {p.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                        tag === "HWO Candidate"
                          ? "bg-accent-green/15 text-accent-green"
                          : "bg-accent-purple/15 text-accent-purple"
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-accent-blue opacity-0 group-hover:opacity-100 transition-opacity">
                {t("planets.view3d")} →
              </span>
            </button>
          ))}
        </div>

        {hasMore && !nameFilter && planets.length > 0 && (
          <div className="flex justify-center pt-2">
            <button
              onClick={loadMore}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-space-850 px-6 py-2 text-xs font-semibold hover:bg-space-800 transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              {t("planets.loadMore")}
            </button>
          </div>
        )}

        {loading && planets.length === 0 && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-accent-blue" />
          </div>
        )}
      </div>
    </div>
  );
}
