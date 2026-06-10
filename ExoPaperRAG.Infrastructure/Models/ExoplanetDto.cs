using System.Text.Json.Serialization;

namespace ExoPaperRAG.Infrastructure.Models;

/// <summary>
/// Raw row from the NASA Exoplanet Archive (pscomppars/ps). Property names map 1:1 to the
/// TAP column names; nullable because most parameters are missing for many planets.
/// </summary>
public class ExoplanetDto
{
    // ── Identity / system ────────────────────────────────────────────────
    [JsonPropertyName("pl_name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("hostname")]
    public string? HostName { get; set; }

    [JsonPropertyName("pl_letter")]
    public string? PlanetLetter { get; set; }

    [JsonPropertyName("sy_snum")]
    public double? NumberOfStars { get; set; }

    [JsonPropertyName("sy_pnum")]
    public double? NumberOfPlanets { get; set; }

    [JsonPropertyName("ra")]
    public double? RightAscension { get; set; }

    [JsonPropertyName("dec")]
    public double? Declination { get; set; }

    [JsonPropertyName("sy_vmag")]
    public double? VMagnitude { get; set; }

    [JsonPropertyName("sy_kmag")]
    public double? KMagnitude { get; set; }

    [JsonPropertyName("sy_gaiamag")]
    public double? GaiaMagnitude { get; set; }

    // ── Aliases ──────────────────────────────────────────────────────────
    [JsonPropertyName("hd_name")]
    public string? HdName { get; set; }

    [JsonPropertyName("hip_name")]
    public string? HipName { get; set; }

    [JsonPropertyName("tic_id")]
    public string? TicId { get; set; }

    // ── Discovery ────────────────────────────────────────────────────────
    [JsonPropertyName("discoverymethod")]
    public string? DiscoveryMethod { get; set; }

    [JsonPropertyName("disc_year")]
    public double? DiscoveryYear { get; set; }

    [JsonPropertyName("disc_facility")]
    public string? DiscoveryFacility { get; set; }

    [JsonPropertyName("disc_telescope")]
    public string? DiscoveryTelescope { get; set; }

    [JsonPropertyName("disc_instrument")]
    public string? DiscoveryInstrument { get; set; }

    // ── Orbit ────────────────────────────────────────────────────────────
    [JsonPropertyName("pl_orbper")]
    public double? OrbitalPeriodDays { get; set; }

    [JsonPropertyName("pl_orbeccen")]
    public double? Eccentricity { get; set; }

    [JsonPropertyName("pl_orbsmax")]
    public double? SemiMajorAxisAu { get; set; }

    [JsonPropertyName("pl_orbincl")]
    public double? InclinationDeg { get; set; }

    // ── Mass / radius / density ──────────────────────────────────────────
    [JsonPropertyName("pl_masse")]
    public double? MassEarth { get; set; }

    [JsonPropertyName("pl_bmasse")]
    public double? MassEarthBest { get; set; }

    [JsonPropertyName("pl_bmassj")]
    public double? MassJupiter { get; set; }

    [JsonPropertyName("pl_bmassprov")]
    public string? MassProvenance { get; set; }

    [JsonPropertyName("pl_msinie")]
    public double? MsiniEarth { get; set; }

    [JsonPropertyName("pl_rade")]
    public double? RadiusEarth { get; set; }

    [JsonPropertyName("pl_radj")]
    public double? RadiusJupiter { get; set; }

    [JsonPropertyName("pl_dens")]
    public double? DensityGramPerCm3 { get; set; }

    // ── Climate ──────────────────────────────────────────────────────────
    [JsonPropertyName("pl_eqt")]
    public double? EquilibriumTemperatureK { get; set; }

    [JsonPropertyName("pl_insol")]
    public double? InsolationFlux { get; set; }

    // ── Host star ────────────────────────────────────────────────────────
    [JsonPropertyName("st_spectype")]
    public string? SpectralType { get; set; }

    [JsonPropertyName("st_teff")]
    public double? StellarEffectiveTemperatureK { get; set; }

    [JsonPropertyName("st_rad")]
    public double? StellarRadiusSolar { get; set; }

    [JsonPropertyName("st_mass")]
    public double? StellarMassSolar { get; set; }

    [JsonPropertyName("st_lum")]
    public double? StellarLuminosityLogSolar { get; set; }

    [JsonPropertyName("st_logg")]
    public double? StellarSurfaceGravity { get; set; }

    [JsonPropertyName("st_met")]
    public double? StellarMetallicity { get; set; }

    [JsonPropertyName("st_age")]
    public double? StellarAgeGyr { get; set; }

    // ── System ───────────────────────────────────────────────────────────
    [JsonPropertyName("sy_dist")]
    public double? DistanceParsecs { get; set; }

    // ── Quality / provenance ─────────────────────────────────────────────
    [JsonPropertyName("soltype")]
    public string? SolutionType { get; set; }

    [JsonPropertyName("pl_controv_flag")]
    public double? ControversialFlag { get; set; }

    [JsonPropertyName("pl_refname")]
    public string? ReferenceName { get; set; }
}
