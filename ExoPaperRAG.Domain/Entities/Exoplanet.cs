namespace ExoPaperRAG.Domain.Entities;

public class Exoplanet
{
    public string Id { get; set; } // RavenDB Document ID (e.g. "exoplanets/Kepler-22b")
    public string Name { get; set; }
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

    // RAG Metadata
    public bool HasEmbeddings { get; set; }

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
            Id = $"exoplanets/{name.Replace(" ", "-")}",
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

    public void MarkAsEmbedded()
    {
        HasEmbeddings = true;
    }
}
