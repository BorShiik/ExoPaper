namespace ExoPaperRAG.Domain.Entities;

public class Exoplanet
{
    public string Id { get; set; } = string.Empty;   // RavenDB Document ID (e.g. "exoplanets/Kepler-22b")
    public string Name { get; set; } = string.Empty;
    public string? DiscoveryMethod { get; set; }

    // ── Identity / system ────────────────────────────────────────────────
    public string? HostName { get; set; }
    public string? PlanetLetter { get; set; }
    public List<string> Aliases { get; set; } = new();
    public int? NumberOfStars { get; set; }
    public int? NumberOfPlanets { get; set; }
    public double? RightAscension { get; set; }
    public double? Declination { get; set; }
    public double? VMagnitude { get; set; }
    public double? KMagnitude { get; set; }
    public double? GaiaMagnitude { get; set; }

    // ── Discovery ────────────────────────────────────────────────────────
    public int? DiscoveryYear { get; set; }
    public string? DiscoveryFacility { get; set; }
    public string? DiscoveryTelescope { get; set; }
    public string? DiscoveryInstrument { get; set; }

    // ── Mass properties ──────────────────────────────────────────────────
    public double? MassEarth { get; set; }
    public double? LowerBoundMassEarth { get; set; }
    public double? MassJupiter { get; set; }
    public string? MassProvenance { get; set; }
    public double? MsiniEarth { get; set; }
    /// <summary>True when <see cref="MassEarth"/> was converted from Jupiter mass / Msini rather than measured directly.</summary>
    public bool MassIsDerived { get; set; }

    // ── Radius / density ─────────────────────────────────────────────────
    public double? RadiusEarth { get; set; }
    public double? RadiusJupiter { get; set; }
    public bool RadiusIsDerived { get; set; }
    public double? DensityGramPerCm3 { get; set; }

    // ── Orbital parameters ───────────────────────────────────────────────
    public double? OrbitalPeriodDays { get; set; }
    public double? Eccentricity { get; set; }
    public double? SemiMajorAxisAu { get; set; }
    public double? InclinationDeg { get; set; }

    // ── Climate ──────────────────────────────────────────────────────────
    public double? EquilibriumTemperatureK { get; set; }
    public bool EquilibriumTemperatureIsDerived { get; set; }
    public double? InsolationFlux { get; set; }

    // ── Host star ────────────────────────────────────────────────────────
    public string? SpectralType { get; set; }
    public double? StellarEffectiveTemperatureK { get; set; }
    public double? StellarRadiusSolar { get; set; }
    public double? StellarMassSolar { get; set; }
    public double? StellarLuminosityLogSolar { get; set; }
    public double? StellarSurfaceGravity { get; set; }
    public double? StellarMetallicity { get; set; }
    public double? StellarAgeGyr { get; set; }

    // ── System parameters ────────────────────────────────────────────────
    public double? DistanceParsecs { get; set; }

    // ── Quality / provenance ─────────────────────────────────────────────
    public string? SolutionType { get; set; }
    public bool? IsControversial { get; set; }
    public string? ReferenceName { get; set; }

    // ── RAG / enrichment metadata (NOT sourced from NASA) ────────────────
    public bool HasEmbeddings { get; set; }
    public List<string> Tags { get; set; } = new();
    public bool TagsProcessed { get; set; } = false;

    /// <summary>Cached RAG general summary of the planet based on literature.</summary>
    public string? CachedAiGeneralSummary { get; set; }

    /// <summary>Cached RAG uncertainty analysis (serialized JSON of the summary result).</summary>
    public string? CachedUncertaintySummary { get; set; }

    /// <summary>Last time the TargetedHarvesterJob queried the arXiv Search API for this planet.</summary>
    public DateTime? LastTargetedHarvestUtc { get; set; }

    // ── Physical constants used for derivation ───────────────────────────
    private const double EarthMassesPerJupiter = 317.82838;
    private const double EarthRadiiPerJupiter = 11.2089;
    private const double SolarRadiusInAu = 0.00465047;
    private const double DefaultBondAlbedo = 0.3;

    private Exoplanet() { } // For ORM / Deserialization

    // ── Factory: rich (catalog) ──────────────────────────────────────────
    public static Exoplanet Create(string name, ExoplanetScientificData data)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Exoplanet name cannot be empty", nameof(name));

        var planet = new Exoplanet
        {
            Id = BuildId(name),
            Name = name,
            HasEmbeddings = false
        };
        planet.Apply(data);
        return planet;
    }

    // ── Factory: legacy positional (tests, manual create command) ────────
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
        => Create(name, new ExoplanetScientificData
        {
            DiscoveryMethod = discoveryMethod,
            MassEarth = massEarth,
            MassEarthBest = lowerBoundMassEarth,
            RadiusEarth = radiusEarth,
            RadiusJupiter = radiusJupiter,
            OrbitalPeriodDays = orbitalPeriodDays,
            Eccentricity = eccentricity,
            SemiMajorAxisAu = semiMajorAxisAu,
            StellarEffectiveTemperatureK = stellarEffectiveTemperatureK,
            DistanceParsecs = distanceParsecs
        });

    /// <summary>Deterministic RavenDB document id derived from the planet name.</summary>
    public static string BuildId(string name) => $"exoplanets/{name.Replace(" ", "-")}";

    // ── Update: rich (catalog) ───────────────────────────────────────────
    /// <summary>
    /// Applies upstream catalog parameters while preserving enrichment state
    /// (<see cref="Tags"/>, <see cref="HasEmbeddings"/>). Returns true and flags the planet
    /// for re-tagging if any tracked scientific field actually changed.
    /// </summary>
    public bool ApplyScientificUpdate(ExoplanetScientificData data) => Apply(data);

    // ── Update: legacy positional ────────────────────────────────────────
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
        => Apply(new ExoplanetScientificData
        {
            DiscoveryMethod = discoveryMethod,
            MassEarth = massEarth,
            MassEarthBest = lowerBoundMassEarth,
            RadiusEarth = radiusEarth,
            RadiusJupiter = radiusJupiter,
            OrbitalPeriodDays = orbitalPeriodDays,
            Eccentricity = eccentricity,
            SemiMajorAxisAu = semiMajorAxisAu,
            StellarEffectiveTemperatureK = stellarEffectiveTemperatureK,
            DistanceParsecs = distanceParsecs
        });

    /// <summary>Assigns catalog fields, runs derivation and detects change for re-tagging.</summary>
    private bool Apply(ExoplanetScientificData d)
    {
        var before = FingerPrint();

        DiscoveryMethod = d.DiscoveryMethod;
        HostName = d.HostName;
        PlanetLetter = d.PlanetLetter;
        Aliases = d.Aliases ?? new List<string>();
        NumberOfStars = d.NumberOfStars;
        NumberOfPlanets = d.NumberOfPlanets;
        RightAscension = d.RightAscension;
        Declination = d.Declination;
        VMagnitude = d.VMagnitude;
        KMagnitude = d.KMagnitude;
        GaiaMagnitude = d.GaiaMagnitude;

        DiscoveryYear = d.DiscoveryYear;
        DiscoveryFacility = d.DiscoveryFacility;
        DiscoveryTelescope = d.DiscoveryTelescope;
        DiscoveryInstrument = d.DiscoveryInstrument;

        LowerBoundMassEarth = d.MassEarthBest;
        MassJupiter = d.MassJupiter;
        MassProvenance = d.MassProvenance;
        MsiniEarth = d.MsiniEarth;

        RadiusJupiter = d.RadiusJupiter;
        DensityGramPerCm3 = d.DensityGramPerCm3;

        OrbitalPeriodDays = d.OrbitalPeriodDays;
        Eccentricity = d.Eccentricity;
        SemiMajorAxisAu = d.SemiMajorAxisAu;
        InclinationDeg = d.InclinationDeg;

        InsolationFlux = d.InsolationFlux;

        SpectralType = d.SpectralType;
        StellarEffectiveTemperatureK = d.StellarEffectiveTemperatureK;
        StellarRadiusSolar = d.StellarRadiusSolar;
        StellarMassSolar = d.StellarMassSolar;
        StellarLuminosityLogSolar = d.StellarLuminosityLogSolar;
        StellarSurfaceGravity = d.StellarSurfaceGravity;
        StellarMetallicity = d.StellarMetallicity;
        StellarAgeGyr = d.StellarAgeGyr;

        DistanceParsecs = d.DistanceParsecs;

        SolutionType = d.SolutionType;
        IsControversial = d.IsControversial;
        ReferenceName = d.ReferenceName;

        DeriveMass(d);
        DeriveRadius(d);
        DeriveEquilibriumTemperature(d);

        var changed = before != FingerPrint();
        if (changed)
            TagsProcessed = false; // scientific inputs changed → re-evaluate tags
        return changed;
    }

    /// <summary>
    /// Resolves the best Earth-mass value. Direct measurement (pl_masse / pl_bmasse) is
    /// preferred; otherwise it is converted from Jupiter mass or Msini and flagged derived.
    /// This is what fills the "no mass" gap for directly-imaged giants stored only in Mjup.
    /// </summary>
    private void DeriveMass(ExoplanetScientificData d)
    {
        if (d.MassEarth.HasValue)
        {
            MassEarth = d.MassEarth;
            MassIsDerived = false;
        }
        else if (d.MassEarthBest.HasValue)
        {
            MassEarth = d.MassEarthBest;
            MassIsDerived = false;
        }
        else if (d.MassJupiter.HasValue)
        {
            MassEarth = d.MassJupiter * EarthMassesPerJupiter;
            MassIsDerived = true;
        }
        else if (d.MsiniEarth.HasValue)
        {
            MassEarth = d.MsiniEarth; // lower bound (M·sin i)
            MassIsDerived = true;
        }
        else
        {
            MassEarth = null;
            MassIsDerived = false;
        }
    }

    private void DeriveRadius(ExoplanetScientificData d)
    {
        if (d.RadiusEarth.HasValue)
        {
            RadiusEarth = d.RadiusEarth;
            RadiusIsDerived = false;
        }
        else if (d.RadiusJupiter.HasValue)
        {
            RadiusEarth = d.RadiusJupiter * EarthRadiiPerJupiter;
            RadiusIsDerived = true;
        }
        else
        {
            RadiusEarth = null;
            RadiusIsDerived = false;
        }
    }

    /// <summary>
    /// Equilibrium temperature: catalog value if present, else estimated from the host star
    /// (T_eq = T_eff · √(R★/2a) · (1−A)^¼) using a default Bond albedo. Flagged when estimated.
    /// </summary>
    private void DeriveEquilibriumTemperature(ExoplanetScientificData d)
    {
        if (d.EquilibriumTemperatureK.HasValue)
        {
            EquilibriumTemperatureK = d.EquilibriumTemperatureK;
            EquilibriumTemperatureIsDerived = false;
            return;
        }

        if (d.StellarEffectiveTemperatureK is > 0 &&
            d.StellarRadiusSolar is > 0 &&
            d.SemiMajorAxisAu is > 0)
        {
            var rStarAu = d.StellarRadiusSolar.Value * SolarRadiusInAu;
            var teq = d.StellarEffectiveTemperatureK.Value
                      * Math.Sqrt(rStarAu / (2.0 * d.SemiMajorAxisAu.Value))
                      * Math.Pow(1.0 - DefaultBondAlbedo, 0.25);

            EquilibriumTemperatureK = Math.Round(teq, 1);
            EquilibriumTemperatureIsDerived = true;
        }
        else
        {
            EquilibriumTemperatureK = null;
            EquilibriumTemperatureIsDerived = false;
        }
    }

    /// <summary>Compact signature of tracked physical fields, used to detect catalog changes.</summary>
    private string FingerPrint() => string.Join('|',
        DiscoveryMethod, MassEarth, LowerBoundMassEarth, MassJupiter, MsiniEarth,
        RadiusEarth, RadiusJupiter, DensityGramPerCm3,
        OrbitalPeriodDays, Eccentricity, SemiMajorAxisAu, InclinationDeg,
        EquilibriumTemperatureK, InsolationFlux,
        StellarEffectiveTemperatureK, StellarRadiusSolar, StellarMassSolar,
        StellarLuminosityLogSolar, StellarMetallicity, StellarAgeGyr, SpectralType,
        DistanceParsecs, IsControversial);

    /// <summary>Updates editable descriptive fields (used by the manual edit endpoint).</summary>
    public void UpdateDescriptive(string name, string? discoveryMethod, double? massEarth)
    {
        if (!string.IsNullOrWhiteSpace(name))
            Name = name;
        DiscoveryMethod = discoveryMethod;
        MassEarth = massEarth;
    }

    public void MarkAsEmbedded() => HasEmbeddings = true;

    /// <summary>
    /// Fraction (0–100) of the key scientific parameters that are populated, used as a
    /// data-quality signal on the UI. Derived (estimated) values count as present.
    /// </summary>
    public int ComputeCompletenessPercent()
    {
        var present = 0;
        var total = 0;

        void Check(bool hasValue) { total++; if (hasValue) present++; }

        Check(MassEarth.HasValue);
        Check(RadiusEarth.HasValue);
        Check(OrbitalPeriodDays.HasValue);
        Check(SemiMajorAxisAu.HasValue);
        Check(Eccentricity.HasValue);
        Check(EquilibriumTemperatureK.HasValue);
        Check(InsolationFlux.HasValue);
        Check(DistanceParsecs.HasValue);
        Check(StellarEffectiveTemperatureK.HasValue);
        Check(StellarRadiusSolar.HasValue);
        Check(!string.IsNullOrWhiteSpace(DiscoveryMethod));
        Check(DiscoveryYear.HasValue);

        return total == 0 ? 0 : (int)Math.Round(present * 100.0 / total);
    }
}
