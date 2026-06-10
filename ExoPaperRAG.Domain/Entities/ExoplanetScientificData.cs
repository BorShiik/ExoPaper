namespace ExoPaperRAG.Domain.Entities;

/// <summary>
/// Raw scientific parameters for a single planet as harvested from an upstream catalog
/// (primarily NASA <c>pscomppars</c>). This is a transport record between the ingestion
/// layer and the <see cref="Exoplanet"/> aggregate — it carries only catalog values, with
/// no derived/computed fields. Derivation (unit conversion, equilibrium temperature, …)
/// happens inside the aggregate so the rules live in one place.
/// </summary>
public record ExoplanetScientificData
{
    // ── Identity / system ────────────────────────────────────────────────
    public string? HostName { get; init; }
    public string? PlanetLetter { get; init; }
    public List<string> Aliases { get; init; } = new();
    public int? NumberOfStars { get; init; }
    public int? NumberOfPlanets { get; init; }
    public double? RightAscension { get; init; }
    public double? Declination { get; init; }
    public double? VMagnitude { get; init; }
    public double? KMagnitude { get; init; }
    public double? GaiaMagnitude { get; init; }

    // ── Discovery ────────────────────────────────────────────────────────
    public string? DiscoveryMethod { get; init; }
    public int? DiscoveryYear { get; init; }
    public string? DiscoveryFacility { get; init; }
    public string? DiscoveryTelescope { get; init; }
    public string? DiscoveryInstrument { get; init; }

    // ── Orbit ────────────────────────────────────────────────────────────
    public double? OrbitalPeriodDays { get; init; }
    public double? SemiMajorAxisAu { get; init; }
    public double? Eccentricity { get; init; }
    public double? InclinationDeg { get; init; }

    // ── Mass / radius / density ──────────────────────────────────────────
    public double? MassEarth { get; init; }          // pl_masse — true mass
    public double? MassEarthBest { get; init; }       // pl_bmasse — best/composite mass
    public double? MassJupiter { get; init; }         // pl_bmassj
    public string? MassProvenance { get; init; }      // pl_bmassprov: Mass / Msini / Mass-Radius
    public double? MsiniEarth { get; init; }          // pl_msinie
    public double? RadiusEarth { get; init; }
    public double? RadiusJupiter { get; init; }
    public double? DensityGramPerCm3 { get; init; }   // pl_dens

    // ── Climate ──────────────────────────────────────────────────────────
    public double? EquilibriumTemperatureK { get; init; } // pl_eqt
    public double? InsolationFlux { get; init; }          // pl_insol (Earth flux units)

    // ── Host star ────────────────────────────────────────────────────────
    public string? SpectralType { get; init; }
    public double? StellarEffectiveTemperatureK { get; init; }
    public double? StellarRadiusSolar { get; init; }
    public double? StellarMassSolar { get; init; }
    public double? StellarLuminosityLogSolar { get; init; }
    public double? StellarSurfaceGravity { get; init; }
    public double? StellarMetallicity { get; init; }
    public double? StellarAgeGyr { get; init; }

    // ── System ───────────────────────────────────────────────────────────
    public double? DistanceParsecs { get; init; }

    // ── Quality / provenance ─────────────────────────────────────────────
    public string? SolutionType { get; init; }
    public bool? IsControversial { get; init; }
    public string? ReferenceName { get; init; }
}
