import type { ReactNode } from "react";
import { Scale, Ruler, Thermometer, MapPin, Orbit } from "lucide-react";
import type { Exoplanet } from "../../types";
import { useT } from "../../i18n/LanguageContext";
import type { TranslationKey } from "../../i18n/translations";
import {
  classifyPlanet,
  compactNumber,
  toJupiterMass,
  toJupiterRadius,
  parsecsToLightYears,
  kelvinToCelsius,
} from "../../lib/utils";

interface Props {
  planet: Exoplanet;
}

interface HeroTile {
  key: TranslationKey;
  icon: ReactNode;
  value: number;
  unit: string;
  decimals: number;
  sub?: string;
  derived?: boolean;
  accent: string;
}

interface SpecRow {
  key: TranslationKey;
  value: number | string;
  unit: string;
  decimals?: number;
  derived?: boolean;
}

interface SpecSection {
  titleKey: TranslationKey;
  rows: SpecRow[];
}

function num(v: number, d = 2): string {
  return compactNumber(v, d);
}

// ── Headline metrics (shown as large tiles) ───────────────────────────────
function buildHero(p: Exoplanet): HeroTile[] {
  const candidates: (HeroTile | null)[] = [
    p.massEarth != null
      ? {
          key: "param.mass",
          icon: <Scale className="h-4 w-4" />,
          value: p.massEarth,
          unit: "M⊕",
          decimals: 2,
          sub: `≈ ${num(toJupiterMass(p.massEarth), 2)} M♃`,
          derived: p.massIsDerived,
          accent: "#88C0D0",
        }
      : null,
    p.radiusEarth != null
      ? {
          key: "param.radius",
          icon: <Ruler className="h-4 w-4" />,
          value: p.radiusEarth,
          unit: "R⊕",
          decimals: 2,
          sub: `≈ ${num(toJupiterRadius(p.radiusEarth), 2)} R♃`,
          derived: p.radiusIsDerived,
          accent: "#A3BE8C",
        }
      : null,
    p.equilibriumTemperatureK != null
      ? {
          key: "param.eqTemp",
          icon: <Thermometer className="h-4 w-4" />,
          value: p.equilibriumTemperatureK,
          unit: "K",
          decimals: 0,
          sub: `≈ ${Math.round(kelvinToCelsius(p.equilibriumTemperatureK)).toLocaleString()} °C`,
          derived: p.equilibriumTemperatureIsDerived,
          accent: "#EBCB8B",
        }
      : null,
    p.distanceParsecs != null
      ? {
          key: "param.distance",
          icon: <MapPin className="h-4 w-4" />,
          value: p.distanceParsecs,
          unit: "pc",
          decimals: 1,
          sub: `≈ ${num(parsecsToLightYears(p.distanceParsecs), 0)} ly`,
          accent: "#B48EAD",
        }
      : null,
    p.orbitalPeriodDays != null
      ? {
          key: "param.period",
          icon: <Orbit className="h-4 w-4" />,
          value: p.orbitalPeriodDays,
          unit: "d",
          decimals: 1,
          sub:
            p.orbitalPeriodDays > 365
              ? `≈ ${num(p.orbitalPeriodDays / 365.25, 1)} yr`
              : undefined,
          accent: "#81A1C1",
        }
      : null,
  ];
  return candidates.filter((c): c is HeroTile => c !== null).slice(0, 3);
}

// ── Remaining parameters (clean label/value rows) ─────────────────────────
function buildSections(p: Exoplanet, heroKeys: Set<string>): SpecSection[] {
  const rows = (items: SpecRow[]) =>
    items.filter((r) => !heroKeys.has(r.key) && hasValue(r.value));

  const sections: SpecSection[] = [
    {
      titleKey: "param.section.planet",
      rows: rows([
        { key: "param.mass", value: p.massEarth ?? "", unit: "M⊕", decimals: 2, derived: p.massIsDerived },
        { key: "param.massJup", value: p.massJupiter ?? "", unit: "M♃", decimals: 3 },
        { key: "param.msini", value: p.msiniEarth ?? "", unit: "M⊕", decimals: 2 },
        { key: "param.radius", value: p.radiusEarth ?? "", unit: "R⊕", decimals: 2, derived: p.radiusIsDerived },
        { key: "param.radiusJup", value: p.radiusJupiter ?? "", unit: "R♃", decimals: 3 },
        { key: "param.density", value: p.densityGramPerCm3 ?? "", unit: "g/cm³", decimals: 2 },
        { key: "param.eqTemp", value: p.equilibriumTemperatureK ?? "", unit: "K", decimals: 0, derived: p.equilibriumTemperatureIsDerived },
        { key: "param.insolation", value: p.insolationFlux ?? "", unit: "S⊕", decimals: 2 },
      ]),
    },
    {
      titleKey: "param.section.orbit",
      rows: rows([
        { key: "param.period", value: p.orbitalPeriodDays ?? "", unit: "d", decimals: 2 },
        { key: "param.semiMajor", value: p.semiMajorAxisAu ?? "", unit: "AU", decimals: 4 },
        { key: "param.eccentricity", value: p.eccentricity ?? "", unit: "", decimals: 3 },
        { key: "param.inclination", value: p.inclinationDeg ?? "", unit: "°", decimals: 2 },
      ]),
    },
    {
      titleKey: "param.section.star",
      rows: rows([
        { key: "param.hostStar", value: p.hostName ?? "", unit: "" },
        { key: "param.spectralType", value: p.spectralType ?? "", unit: "" },
        { key: "param.stellarTeff", value: p.stellarEffectiveTemperatureK ?? "", unit: "K", decimals: 0 },
        { key: "param.stellarRadius", value: p.stellarRadiusSolar ?? "", unit: "R☉", decimals: 3 },
        { key: "param.stellarMass", value: p.stellarMassSolar ?? "", unit: "M☉", decimals: 3 },
        { key: "param.stellarLuminosity", value: p.stellarLuminosityLogSolar ?? "", unit: "log L☉", decimals: 3 },
        { key: "param.stellarLogg", value: p.stellarSurfaceGravity ?? "", unit: "log g", decimals: 2 },
        { key: "param.stellarMetallicity", value: p.stellarMetallicity ?? "", unit: "[Fe/H]", decimals: 2 },
        { key: "param.stellarAge", value: p.stellarAgeGyr ?? "", unit: "Gyr", decimals: 2 },
      ]),
    },
    {
      titleKey: "param.section.system",
      rows: rows([
        { key: "param.distance", value: p.distanceParsecs ?? "", unit: "pc", decimals: 2 },
        { key: "param.numberOfStars", value: p.numberOfStars ?? "", unit: "", decimals: 0 },
        { key: "param.numberOfPlanets", value: p.numberOfPlanets ?? "", unit: "", decimals: 0 },
        { key: "param.discoveryYear", value: p.discoveryYear ?? "", unit: "", decimals: 0 },
        { key: "param.discoveryFacility", value: p.discoveryFacility ?? "", unit: "" },
        { key: "param.discoveryTelescope", value: p.discoveryTelescope ?? "", unit: "" },
        { key: "param.discoveryInstrument", value: p.discoveryInstrument ?? "", unit: "" },
      ]),
    },
    {
      titleKey: "param.section.observation",
      rows: rows([
        { key: "param.ra", value: p.rightAscension ?? "", unit: "°", decimals: 4 },
        { key: "param.dec", value: p.declination ?? "", unit: "°", decimals: 4 },
        { key: "param.vmag", value: p.vMagnitude ?? "", unit: "mag", decimals: 2 },
        { key: "param.kmag", value: p.kMagnitude ?? "", unit: "mag", decimals: 2 },
        { key: "param.gaiamag", value: p.gaiaMagnitude ?? "", unit: "mag", decimals: 2 },
      ]),
    },
  ];

  return sections.filter((s) => s.rows.length > 0);
}

function hasValue(v: SpecRow["value"]): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return Number.isFinite(v);
}

function renderValue(v: SpecRow["value"], decimals?: number): string {
  if (typeof v === "string") return v;
  return num(v, decimals ?? 2);
}

function completenessColor(pct: number): string {
  if (pct >= 70) return "bg-[#A3BE8C]/15 text-[#A3BE8C]";
  if (pct >= 40) return "bg-[#EBCB8B]/15 text-[#EBCB8B]";
  return "bg-[#BF616A]/15 text-[#d98b92]";
}

export default function ParametersGrid({ planet }: Props) {
  const t = useT();

  const hero = buildHero(planet);
  const heroKeys = new Set(hero.map((h) => h.key));
  const sections = buildSections(planet, heroKeys);
  const type = classifyPlanet(planet.massEarth, planet.radiusEarth);
  const completeness = planet.completenessPercent;

  return (
    <div className="glass rounded-xl p-5 animate-fade-in-up">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{t("param.title")}</h3>
          {type && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${type.color}22`, color: type.color }}
            >
              {t(type.key)}
            </span>
          )}
        </div>
        {typeof completeness === "number" && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${completenessColor(completeness)}`}
            title={t("param.completeness")}
          >
            {t("param.completeness")}: {completeness}%
          </span>
        )}
      </div>

      {/* Hero metrics */}
      {hero.length > 0 && (
        <div className={`mb-5 grid gap-3 ${hero.length === 1 ? "grid-cols-1" : hero.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {hero.map((h) => (
            <div
              key={h.key}
              className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-space-800/50 p-3.5"
            >
              <div
                className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full blur-2xl opacity-25"
                style={{ backgroundColor: h.accent }}
              />
              <div className="mb-2 flex items-center gap-1.5" style={{ color: h.accent }}>
                {h.icon}
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {t(h.key)}
                </span>
              </div>
              <p className="font-mono text-xl font-bold leading-none text-text-primary">
                {num(h.value, h.decimals)}
                <span className="ml-1 text-[11px] font-medium text-text-muted">{h.unit}</span>
                {h.derived && <span className="ml-1 text-[11px] text-amber-400/80" title={t("param.estimated")}>≈</span>}
              </p>
              {h.sub && <p className="mt-1.5 text-[11px] text-text-muted">{h.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Detail spec list */}
      {sections.length === 0 && hero.length === 0 ? (
        <p className="text-sm text-text-muted">{t("common.na")}</p>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.titleKey}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent-cyan/80">
                {t(section.titleKey)}
              </p>
              <div className="overflow-hidden rounded-lg border border-white/[0.05]">
                {section.rows.map((r, i) => (
                  <div
                    key={r.key}
                    className={`flex items-center justify-between gap-3 px-3 py-2 ${
                      i % 2 === 0 ? "bg-space-800/40" : "bg-transparent"
                    }`}
                  >
                    <span className="text-[11px] text-text-muted">{t(r.key)}</span>
                    <span className="font-mono text-xs font-semibold text-text-primary">
                      {renderValue(r.value, r.decimals)}
                      {r.unit && <span className="ml-1 text-[10px] text-text-muted">{r.unit}</span>}
                      {r.derived && (
                        <span className="ml-1 text-[10px] text-amber-400/80" title={t("param.estimated")}>≈</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer: provenance & legend */}
      <div className="mt-5 space-y-1 border-t border-white/5 pt-3">
        {planet.isControversial && (
          <p className="text-[10px] font-semibold text-[#d98b92]">⚠ {t("param.controversial")}</p>
        )}
        {(planet.massIsDerived || planet.radiusIsDerived || planet.equilibriumTemperatureIsDerived) && (
          <p className="text-[10px] text-text-muted">{t("param.estimatedLegend")}</p>
        )}
        <p className="text-[10px] text-text-muted">{t("param.source")}</p>
      </div>
    </div>
  );
}
