import { Tag, Orbit } from "lucide-react";
import type { Exoplanet } from "../../types";
import { useT } from "../../i18n/LanguageContext";
import { methodLabel } from "../../lib/utils";

interface Props {
  planet: Exoplanet;
}

export default function PlanetHeader({ planet }: Props) {
  const t = useT();
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-blue/20">
          <Orbit className="h-5 w-5 text-accent-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight sm:text-3xl">
            {planet.name}
          </h1>
          <p className="text-sm text-text-secondary">
            {methodLabel(planet.discoveryMethod, t, t("planet.unknownMethod"))}
          </p>
        </div>
      </div>

      {planet.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {planet.tags.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                tag === "HWO Candidate"
                  ? "bg-accent-green/15 text-accent-green glow-green"
                  : "bg-accent-purple/15 text-accent-purple"
              }`}
            >
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
