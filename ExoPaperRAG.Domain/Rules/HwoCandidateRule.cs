using ExoPaperRAG.Domain.Entities;

namespace ExoPaperRAG.Domain.Rules;

public class HwoCandidateRule : IExoplanetTaggingRule
{
    public string TagName => "HWO Candidate";

    public bool IsMatch(Exoplanet planet)
    {
        // Criteria for HWO Candidate:
        // 1. Radius <= 1.6 Earth radii OR (if radius is null) Mass <= 10 Earth masses
        // 2. Stellar Effective Temperature 3500K - 7500K (roughly corresponding to F, G, K, M spectral classes)
        // Note: For simplicity we rely on parameters rather than spectral class directly, or we can use bounds.

        bool sizeMatch = false;
        if (planet.RadiusEarth.HasValue)
        {
            sizeMatch = planet.RadiusEarth.Value <= 1.6;
        }
        else if (planet.MassEarth.HasValue)
        {
            sizeMatch = planet.MassEarth.Value <= 10.0;
        }

        bool tempMatch;
        if (planet.StellarEffectiveTemperatureK.HasValue)
        {
            // F, G, K, M host stars roughly span 2400–7500 K.
            tempMatch = planet.StellarEffectiveTemperatureK.Value >= 2400 &&
                        planet.StellarEffectiveTemperatureK.Value <= 7500;
        }
        else if (planet.SemiMajorAxisAu.HasValue)
        {
            // No stellar temperature → fall back to a coarse orbital habitable-zone
            // band so planets with unknown host temps can still qualify.
            tempMatch = planet.SemiMajorAxisAu.Value >= 0.3 &&
                        planet.SemiMajorAxisAu.Value <= 2.0;
        }
        else
        {
            tempMatch = false;
        }

        return sizeMatch && tempMatch;
    }
}
