using System.Text.Json.Serialization;

namespace ExoPaperRAG.Infrastructure.Models;

/// <summary>
/// One row of the NASA "ps" table (one publication's parameter set for a planet), including
/// the asymmetric error columns. Used to build per-parameter measurement histories.
/// </summary>
public class PlanetMeasurementDto
{
    [JsonPropertyName("pl_name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("pl_refname")]
    public string? Reference { get; set; }

    [JsonPropertyName("default_flag")]
    public double? DefaultFlag { get; set; }

    // Mass (Earth)
    [JsonPropertyName("pl_bmasse")] public double? MassEarth { get; set; }
    [JsonPropertyName("pl_bmasseerr1")] public double? MassEarthErr1 { get; set; }
    [JsonPropertyName("pl_bmasseerr2")] public double? MassEarthErr2 { get; set; }

    // Radius (Earth)
    [JsonPropertyName("pl_rade")] public double? RadiusEarth { get; set; }
    [JsonPropertyName("pl_radeerr1")] public double? RadiusEarthErr1 { get; set; }
    [JsonPropertyName("pl_radeerr2")] public double? RadiusEarthErr2 { get; set; }

    // Orbital period (days)
    [JsonPropertyName("pl_orbper")] public double? OrbitalPeriodDays { get; set; }
    [JsonPropertyName("pl_orbpererr1")] public double? OrbitalPeriodErr1 { get; set; }
    [JsonPropertyName("pl_orbpererr2")] public double? OrbitalPeriodErr2 { get; set; }

    // Semi-major axis (AU)
    [JsonPropertyName("pl_orbsmax")] public double? SemiMajorAxisAu { get; set; }
    [JsonPropertyName("pl_orbsmaxerr1")] public double? SemiMajorAxisErr1 { get; set; }
    [JsonPropertyName("pl_orbsmaxerr2")] public double? SemiMajorAxisErr2 { get; set; }

    // Eccentricity
    [JsonPropertyName("pl_orbeccen")] public double? Eccentricity { get; set; }
    [JsonPropertyName("pl_orbeccenerr1")] public double? EccentricityErr1 { get; set; }
    [JsonPropertyName("pl_orbeccenerr2")] public double? EccentricityErr2 { get; set; }

    // Equilibrium temperature (K)
    [JsonPropertyName("pl_eqt")] public double? EquilibriumTemperatureK { get; set; }
    [JsonPropertyName("pl_eqterr1")] public double? EquilibriumTemperatureErr1 { get; set; }
    [JsonPropertyName("pl_eqterr2")] public double? EquilibriumTemperatureErr2 { get; set; }
}
