import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronLeft, Info, Loader2 } from "lucide-react";
import Header from "../components/layout/Header";
import { getExoplanetById } from "../api/exoplanets";
import type { Exoplanet } from "../types";
import { useT } from "../i18n/LanguageContext";

import PlanetHeader from "../components/planet/PlanetHeader";
import ParametersGrid from "../components/planet/ParametersGrid";
import UncertaintyPanel from "../components/planet/UncertaintyPanel";
import LinkedPapers from "../components/planet/LinkedPapers";
import AskPanel from "../components/planet/AskPanel";
import ExoplanetScene from "../components/three/ExoplanetScene";

export default function PlanetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const [planet, setPlanet] = useState<Exoplanet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fullId = id && !id.startsWith("exoplanets/") ? `exoplanets/${id}` : id;

  useEffect(() => {
    if (!fullId) return;

    let active = true;
    const fetchPlanet = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getExoplanetById(fullId);
        if (active) {
          setPlanet(data);
        }
      } catch (e) {
        console.error(e);
        if (active) {
          setError(t("planet.notFound"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchPlanet();
    return () => {
      active = false;
    };
  }, [fullId, t]);

  return (
    <div className="flex flex-col min-h-screen bg-space-950 text-text-primary">
      <Header title={t("page.planet")} />

      <div className="flex-1 p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-space-850 transition-all w-fit"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("planet.back")}
        </button>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            <p className="text-xs text-text-muted">{t("planet.decoding")}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-accent-red/25 bg-accent-red/5 p-6 text-center max-w-md mx-auto my-12">
            <Info className="h-6 w-6 text-accent-red mx-auto mb-2" />
            <p className="text-xs font-semibold text-text-primary mb-1">{t("planet.retrievalFailed")}</p>
            <p className="text-xs text-text-muted mb-4">{error}</p>
            <button
              onClick={() => navigate("/")}
              className="rounded-lg bg-space-800 px-4 py-2 text-xs font-semibold hover:bg-space-700 transition-colors"
            >
              {t("planet.returnHome")}
            </button>
          </div>
        )}

        {!loading && !error && planet && (
          <div className="space-y-6">
            <PlanetHeader planet={planet} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-6">
                <div className="glass rounded-xl overflow-hidden border border-space-800 relative h-[340px] sm:h-[420px] lg:h-[450px]">
                  <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <span className="rounded bg-space-950/80 px-2.5 py-1 text-[10px] font-semibold text-accent-blue uppercase tracking-wider border border-accent-blue/15 backdrop-blur">
                      {t("planet.model3d")}
                    </span>
                  </div>
                  <ExoplanetScene planet={planet} />
                </div>

                <UncertaintyPanel planetId={planet.id} />

                <AskPanel exoplanetId={planet.id} />
              </div>

              <div className="lg:col-span-5 space-y-6">
                <ParametersGrid planet={planet} />
                <LinkedPapers planetId={planet.id} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
