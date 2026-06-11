import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Globe2,
  Loader2,
  Search,
  Telescope,
  Sparkles,
  ArrowUpRight,
  Orbit,
  Ruler,
  Weight,
  Timer,
  MapPin,
} from "lucide-react";
import Header from "../components/layout/Header";
import { getExoplanets } from "../api/exoplanets";
import type { Exoplanet } from "../types";
import { shortId, methodLabel, formatValue } from "../lib/utils";
import { useT } from "../i18n/LanguageContext";
import { useAppStore } from "../stores/appStore";

const PAGE = 24;

const METHODS = [
  { value: "", key: "search.any" as const },
  { value: "Transit", key: "method.transit" as const },
  { value: "Radial Velocity", key: "method.radialVelocity" as const },
  { value: "Microlensing", key: "method.microlensing" as const },
  { value: "Imaging", key: "method.directImaging" as const },
  { value: "Transit Timing Variations", key: "method.ttv" as const },
];

/** Derives a procedural look for the planet "disc" from its physical class. */
function planetLook(radius: number | null | undefined, isHwo: boolean) {
  const r = radius ?? 1;
  if (isHwo) {
    return {
      gradient:
        "radial-gradient(circle at 32% 28%, #d8f5e3 0%, #8dd1a8 28%, #3f9d6e 60%, #1d5e44 100%)",
      glow: "rgba(163,190,140,0.55)",
      accent: "#A3BE8C",
      ring: false,
      label: "Habitable candidate",
    };
  }
  if (r >= 6) {
    return {
      gradient:
        "radial-gradient(circle at 32% 28%, #ffe2c2 0%, #e7a06a 26%, #b9603f 62%, #5e2a22 100%)",
      glow: "rgba(208,135,112,0.45)",
      accent: "#D08770",
      ring: true,
      label: "Gas giant",
    };
  }
  if (r >= 2) {
    return {
      gradient:
        "radial-gradient(circle at 32% 28%, #d6ecff 0%, #8fb8e6 28%, #5277b8 62%, #28365e 100%)",
      glow: "rgba(129,161,193,0.45)",
      accent: "#81A1C1",
      ring: r >= 3.6,
      label: "Ice / Neptune-like",
    };
  }
  return {
    gradient:
      "radial-gradient(circle at 32% 28%, #cfe6e8 0%, #8fbcbb 26%, #5a8a8e 60%, #2a4446 100%)",
    glow: "rgba(143,188,187,0.45)",
    accent: "#8FBCBB",
    ring: false,
    label: "Rocky world",
  };
}

function Param({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Ruler;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-2.5 py-2">
      <p className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-[#7a869c]">
        <Icon className="h-2.5 w-2.5" style={{ color: accent }} />
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[12px] text-[#E5E9F0]">{value}</p>
    </div>
  );
}

function PlanetCard({
  planet,
  index,
  onOpen,
}: {
  planet: Exoplanet;
  index: number;
  onOpen: () => void;
}) {
  const t = useT();
  const isHwo = planet.tags?.includes("HWO Candidate");
  const look = useMemo(() => planetLook(planet.radiusEarth, isHwo), [planet.radiusEarth, isHwo]);

  // Pointer-tracking 3D tilt.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 220, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 220, damping: 18 });

  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const reset = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.03, 0.4), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      className="group relative flex flex-col text-left rounded-2xl border border-white/[0.07] bg-[#0d1322]/55 backdrop-blur-xl p-5 overflow-hidden transition-colors duration-300 hover:border-white/20"
    >
      {/* Hover glow following the accent */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ boxShadow: `0 18px 60px -22px ${look.glow}, inset 0 0 0 1px ${look.glow}` }}
      />

      <div className="relative flex items-start gap-4">
        {/* Procedural planet disc */}
        <div className="relative shrink-0" style={{ perspective: 400 }}>
          <div
            className="h-14 w-14 rounded-full shadow-inner transition-transform duration-500 group-hover:scale-110"
            style={{
              background: look.gradient,
              boxShadow: `0 0 24px -4px ${look.glow}, inset -6px -6px 14px rgba(0,0,0,0.55)`,
            }}
          />
          {look.ring && (
            <div
              className="absolute left-1/2 top-1/2 h-3 w-[78px] -translate-x-1/2 -translate-y-1/2 rounded-[100%] border opacity-80"
              style={{ borderColor: look.accent, transform: "translate(-50%,-50%) rotate(-22deg)" }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[15px] font-semibold text-[#ECEFF4] transition-colors group-hover:text-white">
              {planet.name}
            </h3>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-[#7a869c] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#ECEFF4]" />
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#9aa7bd]">
            <Telescope className="h-3 w-3" style={{ color: look.accent }} />
            {methodLabel(planet.discoveryMethod, t, t("planet.unknownMethod"))}
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: look.accent }}>
            {look.label}
          </p>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <Param icon={Ruler} label={t("param.radius")} value={formatValue(planet.radiusEarth, 2, "R⊕")} accent={look.accent} />
        <Param icon={Weight} label={t("param.mass")} value={formatValue(planet.massEarth, 2, "M⊕")} accent={look.accent} />
        <Param icon={Timer} label={t("param.period")} value={formatValue(planet.orbitalPeriodDays, 1, t("param.days"))} accent={look.accent} />
        <Param icon={MapPin} label={t("param.distance")} value={formatValue(planet.distanceParsecs, 1, "pc")} accent={look.accent} />
      </div>

      {planet.tags.length > 0 && (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {planet.tags.map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                tag === "HWO Candidate"
                  ? "bg-[#A3BE8C]/15 text-[#A3BE8C]"
                  : "bg-[#B48EAD]/15 text-[#B48EAD]"
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="relative mt-3 flex items-center gap-1 text-[10px] font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ color: look.accent }}>
        <Orbit className="h-3 w-3" />
        {t("planets.view3d")}
      </div>
    </motion.button>
  );
}

function PlanetSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0d1322]/50 p-5">
      <div className="flex gap-4">
        <div className="h-14 w-14 rounded-full animate-shimmer-aurora" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 w-2/3 rounded animate-shimmer-aurora" />
          <div className="h-2.5 w-1/3 rounded animate-shimmer-aurora" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded-xl animate-shimmer-aurora" />
        ))}
      </div>
    </div>
  );
}

export default function PlanetsPage() {
  const t = useT();
  const navigate = useNavigate();

  const {
    planetsList: planets,
    planetsMethod: method,
    planetsNameFilter: nameFilter,
    planetsSkip: skip,
    planetsScrollY,
    setPlanetsCatalogState,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(planets.length === 0 || planets.length % PAGE === 0);

  const fetchPage = async (currentSkip: number, append: boolean, discoveryMethod: string) => {
    setLoading(true);
    try {
      const data = await getExoplanets({
        discoveryMethod: discoveryMethod || undefined,
        skip: currentSkip,
        take: PAGE,
        sortBy: "orbitalPeriod",
      });
      const nextPlanets = append ? [...useAppStore.getState().planetsList, ...data] : data;
      setPlanetsCatalogState({
        planetsList: nextPlanets,
        planetsSkip: currentSkip,
      });
      setHasMore(data.length === PAGE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isInitial = useRef(true);

  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      if (planets.length > 0) {
        // Restore scroll position
        if (planetsScrollY > 0) {
          const timeoutId = setTimeout(() => {
            window.scrollTo({ top: planetsScrollY, behavior: "instant" as ScrollBehavior });
          }, 80);
          return () => clearTimeout(timeoutId);
        }
        return;
      }
    }

    setPlanetsCatalogState({ planetsList: [], planetsSkip: 0 });
    fetchPage(0, false, method);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  // Save scroll position on unmount
  useEffect(() => {
    return () => {
      setPlanetsCatalogState({ planetsScrollY: window.scrollY });
    };
  }, [setPlanetsCatalogState]);

  const loadMore = () => {
    const next = skip + PAGE;
    fetchPage(next, true, method);
  };

  const visible = planets.filter((p) =>
    p.name.toLowerCase().includes(nameFilter.trim().toLowerCase())
  );

  return (
    <div className="relative min-h-screen pointer-events-auto text-[#E5E9F0]">
      <Header title={t("page.planets")} />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:pl-28">
        {/* Title strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#88C0D0]/25 bg-[#88C0D0]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#88C0D0]">
              <Sparkles className="h-3 w-3" />
              {t("page.planets")}
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#ECEFF4] sm:text-4xl">
              <span className="bg-gradient-to-r from-[#ECEFF4] via-[#88C0D0] to-[#5E81AC] bg-clip-text text-transparent">
                {t("hero.title")}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0d1322]/60 px-4 py-2 backdrop-blur-xl">
            <Globe2 className="h-4 w-4 text-[#88C0D0]" />
            <span className="font-mono text-lg font-bold text-[#ECEFF4]">{visible.length}</span>
            <span className="text-[11px] text-[#9aa7bd]">/ {t("stats.exoplanets")}</span>
          </div>
        </motion.div>

        {/* Controls */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="mb-7 rounded-2xl border border-white/10 bg-[#0d1322]/55 p-4 backdrop-blur-xl"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a869c]" />
            <input
              value={nameFilter}
              onChange={(e) => setPlanetsCatalogState({ planetsNameFilter: e.target.value })}
              placeholder={t("planets.namePlaceholder")}
              className="w-full rounded-xl border border-white/10 bg-[#070b14]/70 py-2.5 pl-11 pr-4 text-sm text-[#ECEFF4] placeholder:text-[#5b6678] transition-all focus:border-[#88C0D0]/50 focus:outline-none focus:ring-2 focus:ring-[#88C0D0]/20"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {METHODS.map((m) => {
              const active = method === m.value;
              return (
                <button
                  key={m.value || "any"}
                  onClick={() => setPlanetsCatalogState({ planetsMethod: m.value })}
                  className={`relative rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-colors ${
                    active ? "text-[#05070f]" : "text-[#9aa7bd] hover:text-[#ECEFF4]"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="method-pill"
                      className="absolute inset-0 rounded-full bg-[#88C0D0]"
                      transition={{ type: "spring", stiffness: 480, damping: 36 }}
                    />
                  )}
                  <span className="relative">{t(m.key)}</span>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Empty */}
        {!loading && visible.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-white/10 bg-[#0d1322]/40 py-16 text-center"
          >
            <Globe2 className="mx-auto mb-3 h-10 w-10 text-[#4c566a]" />
            <p className="text-sm text-[#9aa7bd]">{t("planets.empty")}</p>
          </motion.div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading && planets.length === 0
            ? Array.from({ length: 6 }).map((_, i) => <PlanetSkeleton key={i} />)
            : null}

          {visible.map((p, i) => (
            <PlanetCard
              key={p.id}
              planet={p}
              index={i}
              onOpen={() => navigate(`/planet/${encodeURIComponent(shortId(p.id))}`)}
            />
          ))}
        </div>

        {/* Load more */}
        {hasMore && !nameFilter && planets.length > 0 && (
          <div className="flex justify-center pt-8">
            <button
              onClick={loadMore}
              disabled={loading}
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1322]/70 px-7 py-2.5 text-xs font-semibold text-[#ECEFF4] backdrop-blur-xl transition-all hover:border-[#88C0D0]/50 hover:shadow-[0_0_24px_-6px_rgba(136,192,208,0.5)] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#88C0D0]" />
              ) : (
                <Orbit className="h-3.5 w-3.5 text-[#88C0D0] transition-transform group-hover:rotate-90" />
              )}
              {t("planets.loadMore")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
