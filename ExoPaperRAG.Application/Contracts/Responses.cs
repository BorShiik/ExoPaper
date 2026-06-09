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
    public double? MassEarth { get; init; }
    public double? LowerBoundMassEarth { get; init; }
    public double? RadiusEarth { get; init; }
    public double? RadiusJupiter { get; init; }
    public double? OrbitalPeriodDays { get; init; }
    public double? Eccentricity { get; init; }
    public double? SemiMajorAxisAu { get; init; }
    public double? StellarEffectiveTemperatureK { get; init; }
    public double? DistanceParsecs { get; init; }
    public IReadOnlyList<string> Tags { get; init; } = Array.Empty<string>();
    public bool HasEmbeddings { get; init; }
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
        MassEarth = e.MassEarth,
        LowerBoundMassEarth = e.LowerBoundMassEarth,
        RadiusEarth = e.RadiusEarth,
        RadiusJupiter = e.RadiusJupiter,
        OrbitalPeriodDays = e.OrbitalPeriodDays,
        Eccentricity = e.Eccentricity,
        SemiMajorAxisAu = e.SemiMajorAxisAu,
        StellarEffectiveTemperatureK = e.StellarEffectiveTemperatureK,
        DistanceParsecs = e.DistanceParsecs,
        Tags = e.Tags,
        HasEmbeddings = e.HasEmbeddings
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
