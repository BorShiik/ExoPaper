namespace ExoPaperRAG.Domain.Entities;

public class Exoplanet
{
    public string Id { get; set; } = string.Empty;   // RavenDB Document ID (e.g. "exoplanets/Kepler-22b")
    public string Name { get; set; } = string.Empty;
    public string? DiscoveryMethod { get; set; }

    // Mass properties
    public double? MassEarth { get; set; }
    public double? LowerBoundMassEarth { get; set; }

    // Radius properties
    public double? RadiusEarth { get; set; }
    public double? RadiusJupiter { get; set; }

    // Orbital parameters
    public double? OrbitalPeriodDays { get; set; }
    public double? Eccentricity { get; set; }
    public double? SemiMajorAxisAu { get; set; }

    // Stellar parameters
    public double? StellarEffectiveTemperatureK { get; set; }

    // System parameters
    public double? DistanceParsecs { get; set; }

    // RAG Metadata (enrichment — NOT sourced from NASA)
    public bool HasEmbeddings { get; set; }

    // Auto-Tagging (enrichment — NOT sourced from NASA)
    public List<string> Tags { get; set; } = new();
    public bool TagsProcessed { get; set; } = false;

    /// <summary>
    /// Cached RAG uncertainty analysis (serialized JSON of the summary result).
    /// Populated on first analysis so we don't re-invoke the local LLM on every
    /// request. Cleared/overwritten via the "regenerate" path.
    /// </summary>
    public string? CachedUncertaintySummary { get; set; }

    private Exoplanet() { } // For ORM / Deserialization

    public static Exoplanet Create(
        string name,
        string? discoveryMethod,
        double? massEarth,
        double? lowerBoundMassEarth,
        double? radiusEarth,
        double? radiusJupiter,
        double? orbitalPeriodDays,
        double? eccentricity,
        double? semiMajorAxisAu,
        double? stellarEffectiveTemperatureK,
        double? distanceParsecs)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Exoplanet name cannot be empty", nameof(name));

        return new Exoplanet
        {
            Id = BuildId(name),
            Name = name,
            DiscoveryMethod = discoveryMethod,
            MassEarth = massEarth,
            LowerBoundMassEarth = lowerBoundMassEarth,
            RadiusEarth = radiusEarth,
            RadiusJupiter = radiusJupiter,
            OrbitalPeriodDays = orbitalPeriodDays,
            Eccentricity = eccentricity,
            SemiMajorAxisAu = semiMajorAxisAu,
            StellarEffectiveTemperatureK = stellarEffectiveTemperatureK,
            DistanceParsecs = distanceParsecs,
            HasEmbeddings = false
        };
    }

    /// <summary>
    /// Deterministic RavenDB document id derived from the planet name.
    /// </summary>
    public static string BuildId(string name) => $"exoplanets/{name.Replace(" ", "-")}";

    /// <summary>
    /// Applies the scientific parameters coming from an upstream catalog (NASA) while
    /// preserving derived/enrichment state (<see cref="Tags"/>, <see cref="HasEmbeddings"/>).
    /// If any tracked scientific field actually changed, the planet is flagged for
    /// re-tagging (<see cref="TagsProcessed"/> = false) and the method returns true.
    /// </summary>
    public bool ApplyScientificUpdate(
        string? discoveryMethod,
        double? massEarth,
        double? lowerBoundMassEarth,
        double? radiusEarth,
        double? radiusJupiter,
        double? orbitalPeriodDays,
        double? eccentricity,
        double? semiMajorAxisAu,
        double? stellarEffectiveTemperatureK,
        double? distanceParsecs)
    {
        var changed =
            DiscoveryMethod != discoveryMethod ||
            MassEarth != massEarth ||
            LowerBoundMassEarth != lowerBoundMassEarth ||
            RadiusEarth != radiusEarth ||
            RadiusJupiter != radiusJupiter ||
            OrbitalPeriodDays != orbitalPeriodDays ||
            Eccentricity != eccentricity ||
            SemiMajorAxisAu != semiMajorAxisAu ||
            StellarEffectiveTemperatureK != stellarEffectiveTemperatureK ||
            DistanceParsecs != distanceParsecs;

        if (!changed)
            return false;

        DiscoveryMethod = discoveryMethod;
        MassEarth = massEarth;
        LowerBoundMassEarth = lowerBoundMassEarth;
        RadiusEarth = radiusEarth;
        RadiusJupiter = radiusJupiter;
        OrbitalPeriodDays = orbitalPeriodDays;
        Eccentricity = eccentricity;
        SemiMajorAxisAu = semiMajorAxisAu;
        StellarEffectiveTemperatureK = stellarEffectiveTemperatureK;
        DistanceParsecs = distanceParsecs;

        // Scientific inputs changed → tags must be re-evaluated by the tagging worker.
        TagsProcessed = false;
        return true;
    }

    /// <summary>Updates editable descriptive fields (used by the manual edit endpoint).</summary>
    public void UpdateDescriptive(string name, string? discoveryMethod, double? massEarth)
    {
        if (!string.IsNullOrWhiteSpace(name))
            Name = name;
        DiscoveryMethod = discoveryMethod;
        MassEarth = massEarth;
    }

    public void MarkAsEmbedded() => HasEmbeddings = true;
}
