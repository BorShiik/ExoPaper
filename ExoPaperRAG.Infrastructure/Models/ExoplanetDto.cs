using System.Text.Json.Serialization;

namespace ExoPaperRAG.Infrastructure.Models;

public class ExoplanetDto
{
    [JsonPropertyName("pl_name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("discoverymethod")]
    public string? DiscoveryMethod { get; set; }

    [JsonPropertyName("pl_masse")]
    public double? MassEarth { get; set; }

    [JsonPropertyName("pl_bmasse")]
    public double? LowerBoundMassEarth { get; set; }

    [JsonPropertyName("pl_rade")]
    public double? RadiusEarth { get; set; }

    [JsonPropertyName("pl_radj")]
    public double? RadiusJupiter { get; set; }

    [JsonPropertyName("pl_orbper")]
    public double? OrbitalPeriodDays { get; set; }

    [JsonPropertyName("pl_orbeccen")]
    public double? Eccentricity { get; set; }

    [JsonPropertyName("pl_orbsmax")]
    public double? SemiMajorAxisAu { get; set; }

    [JsonPropertyName("st_teff")]
    public double? StellarEffectiveTemperatureK { get; set; }

    [JsonPropertyName("sy_dist")]
    public double? DistanceParsecs { get; set; }
}
