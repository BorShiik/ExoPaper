import type { Exoplanet } from "../../types";
import { formatValue } from "../../lib/utils";
import { useT } from "../../i18n/LanguageContext";
import type { TranslationKey } from "../../i18n/translations";

interface Props {
  planet: Exoplanet;
}

const params = (
  planet: Exoplanet,
  daysLabel: string
): { labelKey: TranslationKey; value: string; unit: string }[] => [
  { labelKey: "param.mass", value: formatValue(planet.massEarth, 4), unit: "M⊕" },
  { labelKey: "param.lowerMass", value: formatValue(planet.lowerBoundMassEarth, 4), unit: "M⊕" },
  { labelKey: "param.radius", value: formatValue(planet.radiusEarth, 4), unit: "R⊕" },
  { labelKey: "param.radiusJup", value: formatValue(planet.radiusJupiter, 4), unit: "R_J" },
  { labelKey: "param.period", value: formatValue(planet.orbitalPeriodDays, 2), unit: daysLabel },
  { labelKey: "param.eccentricity", value: formatValue(planet.eccentricity, 4), unit: "" },
  { labelKey: "param.semiMajor", value: formatValue(planet.semiMajorAxisAu, 4), unit: "AU" },
  { labelKey: "param.stellarTeff", value: formatValue(planet.stellarEffectiveTemperatureK, 0), unit: "K" },
  { labelKey: "param.distance", value: formatValue(planet.distanceParsecs, 2), unit: "pc" },
];

export default function ParametersGrid({ planet }: Props) {
  const t = useT();
  const data = params(planet, t("param.days"));
  const na = t("common.na");

  return (
    <div className="glass rounded-xl p-5 animate-fade-in-up">
      <h3 className="text-sm font-semibold text-text-primary mb-4">{t("param.title")}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.map((p) => (
          <div
            key={p.labelKey}
            className="rounded-lg bg-space-800/60 p-3 hover:bg-space-700/60 transition-colors"
          >
            <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
              {t(p.labelKey)}
            </p>
            <p className="text-sm font-semibold text-text-primary font-mono">
              {p.value === "N/A" ? na : p.value}
              {p.unit && p.value !== "N/A" && (
                <span className="text-text-muted text-[10px] ml-1">{p.unit}</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
