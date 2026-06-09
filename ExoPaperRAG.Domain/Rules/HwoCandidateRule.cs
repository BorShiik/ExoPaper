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

        bool tempMatch = false;
        if (planet.StellarEffectiveTemperatureK.HasValue)
        {
            tempMatch = planet.StellarEffectiveTemperatureK.Value >= 2400 && 
                        planet.StellarEffectiveTemperatureK.Value <= 7500;
        }
        else
        {
            // If we don't know the star temp, we might not want to classify it, 
            // but let's be optimistic or pessimistic. Let's say we need temp to be sure.
            tempMatch = false;
        }

        return sizeMatch && tempMatch;
    }
}
