using ExoPaperRAG.Domain.Entities;

namespace ExoPaperRAG.Application.Contracts;

// ──────────────────────────────────────────────────────────────────────────
//  API response contracts. Entities never leave the Application layer directly;
//  these records define the public shape and deliberately exclude internal
//  fields such as the embedding Vector and processing flags.
// ──────────────────────────────────────────────────────────────────────────

public record ExoplanetResponse
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? DiscoveryMethod { get; init; }

    // Identity / system
    public string? HostName { get; init; }
    public string? PlanetLetter { get; init; }
    public IReadOnlyList<string> Aliases { get; init; } = Array.Empty<string>();
    public int? NumberOfStars { get; init; }
    public int? NumberOfPlanets { get; init; }
    public double? RightAscension { get; init; }
    public double? Declination { get; init; }
    public double? VMagnitude { get; init; }
    public double? KMagnitude { get; init; }
    public double? GaiaMagnitude { get; init; }

    // Discovery
    public int? DiscoveryYear { get; init; }
    public string? DiscoveryFacility { get; init; }
    public string? DiscoveryTelescope { get; init; }
    public string? DiscoveryInstrument { get; init; }

    // Mass / radius / density
    public double? MassEarth { get; init; }
    public double? LowerBoundMassEarth { get; init; }
    public double? MassJupiter { get; init; }
    public string? MassProvenance { get; init; }
    public double? MsiniEarth { get; init; }
    public bool MassIsDerived { get; init; }
    public double? RadiusEarth { get; init; }
    public double? RadiusJupiter { get; init; }
    public bool RadiusIsDerived { get; init; }
    public double? DensityGramPerCm3 { get; init; }

    // Orbit
    public double? OrbitalPeriodDays { get; init; }
    public double? Eccentricity { get; init; }
    public double? SemiMajorAxisAu { get; init; }
    public double? InclinationDeg { get; init; }

    // Climate
    public double? EquilibriumTemperatureK { get; init; }
    public bool EquilibriumTemperatureIsDerived { get; init; }
    public double? InsolationFlux { get; init; }

    // Host star
    public string? SpectralType { get; init; }
    public double? StellarEffectiveTemperatureK { get; init; }
    public double? StellarRadiusSolar { get; init; }
    public double? StellarMassSolar { get; init; }
    public double? StellarLuminosityLogSolar { get; init; }
    public double? StellarSurfaceGravity { get; init; }
    public double? StellarMetallicity { get; init; }
    public double? StellarAgeGyr { get; init; }

    // System
    public double? DistanceParsecs { get; init; }

    // Quality
    public bool? IsControversial { get; init; }
    /// <summary>0–100: share of key scientific parameters that are populated (data-quality signal).</summary>
    public int CompletenessPercent { get; init; }

    public IReadOnlyList<string> Tags { get; init; } = Array.Empty<string>();
    public bool HasEmbeddings { get; init; }
    /// <summary>True if a cached uncertainty analysis already exists for this planet.</summary>
    public bool HasCachedUncertainty { get; init; }
    /// <summary>True if a cached general AI summary exists.</summary>
    public bool HasCachedAiSummary { get; init; }
}

public record PaperResponse
{
    public string Id { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Abstract { get; init; } = string.Empty;
    public DateTime PublishedDate { get; init; }
    public IReadOnlyList<string> AuthorIds { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> ExoplanetIds { get; init; } = Array.Empty<string>();
    public bool IsReviewed { get; init; }
    public bool HasEmbeddings { get; init; }
}

public record AuthorResponse
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Affiliation { get; init; } = string.Empty;
}

public record PaperWithAuthorsResponse
{
    public PaperResponse Paper { get; init; } = new();
    public IReadOnlyList<AuthorResponse> Authors { get; init; } = Array.Empty<AuthorResponse>();
}

public record DiscoveryStatResponse
{
    public string DiscoveryMethod { get; init; } = string.Empty;
    public int Count { get; init; }
    public double TotalMass { get; init; }
    public double AverageMass { get; init; }
}

public record SyncStatusResponse
{
    public string ProviderName { get; init; } = string.Empty;
    public DateTime LastSyncUtc { get; init; }
    public int TotalDocumentsSynced { get; init; }
    public string? LastError { get; init; }
}

/// <summary>Maps domain entities to their public response contracts.</summary>
public static class Mappings
{
    public static ExoplanetResponse ToResponse(this Exoplanet e) => new()
    {
        Id = e.Id,
        Name = e.Name,
        DiscoveryMethod = e.DiscoveryMethod,

        HostName = e.HostName,
        PlanetLetter = e.PlanetLetter,
        Aliases = e.Aliases,
        NumberOfStars = e.NumberOfStars,
        NumberOfPlanets = e.NumberOfPlanets,
        RightAscension = e.RightAscension,
        Declination = e.Declination,
        VMagnitude = e.VMagnitude,
        KMagnitude = e.KMagnitude,
        GaiaMagnitude = e.GaiaMagnitude,

        DiscoveryYear = e.DiscoveryYear,
        DiscoveryFacility = e.DiscoveryFacility,
        DiscoveryTelescope = e.DiscoveryTelescope,
        DiscoveryInstrument = e.DiscoveryInstrument,

        MassEarth = e.MassEarth,
        LowerBoundMassEarth = e.LowerBoundMassEarth,
        MassJupiter = e.MassJupiter,
        MassProvenance = e.MassProvenance,
        MsiniEarth = e.MsiniEarth,
        MassIsDerived = e.MassIsDerived,
        RadiusEarth = e.RadiusEarth,
        RadiusJupiter = e.RadiusJupiter,
        RadiusIsDerived = e.RadiusIsDerived,
        DensityGramPerCm3 = e.DensityGramPerCm3,

        OrbitalPeriodDays = e.OrbitalPeriodDays,
        Eccentricity = e.Eccentricity,
        SemiMajorAxisAu = e.SemiMajorAxisAu,
        InclinationDeg = e.InclinationDeg,

        EquilibriumTemperatureK = e.EquilibriumTemperatureK,
        EquilibriumTemperatureIsDerived = e.EquilibriumTemperatureIsDerived,
        InsolationFlux = e.InsolationFlux,

        SpectralType = e.SpectralType,
        StellarEffectiveTemperatureK = e.StellarEffectiveTemperatureK,
        StellarRadiusSolar = e.StellarRadiusSolar,
        StellarMassSolar = e.StellarMassSolar,
        StellarLuminosityLogSolar = e.StellarLuminosityLogSolar,
        StellarSurfaceGravity = e.StellarSurfaceGravity,
        StellarMetallicity = e.StellarMetallicity,
        StellarAgeGyr = e.StellarAgeGyr,

        DistanceParsecs = e.DistanceParsecs,
        IsControversial = e.IsControversial,
        CompletenessPercent = e.ComputeCompletenessPercent(),

        Tags = e.Tags,
        HasEmbeddings = e.HasEmbeddings,
        HasCachedUncertainty = !string.IsNullOrEmpty(e.CachedUncertaintySummary),
        HasCachedAiSummary = !string.IsNullOrEmpty(e.CachedAiGeneralSummary)
    };

    public static PaperResponse ToResponse(this Paper p) => new()
    {
        Id = p.Id,
        Title = p.Title,
        Abstract = p.Abstract,
        PublishedDate = p.PublishedDate,
        AuthorIds = p.AuthorIds,
        ExoplanetIds = p.ExoplanetIds,
        IsReviewed = p.IsReviewed,
        HasEmbeddings = p.HasEmbeddings
    };

    public static AuthorResponse ToResponse(this Author a) => new()
    {
        Id = a.Id,
        Name = a.Name,
        Affiliation = a.Affiliation
    };
}
