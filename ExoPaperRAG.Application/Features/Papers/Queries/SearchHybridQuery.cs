using MediatR;
using ExoPaperRAG.Domain.Entities;

namespace ExoPaperRAG.Application.Features.Papers.Queries;

/// <summary>
/// Hybrid search: combines hard filters (planet mass/radius) with
/// semantic vector search over paper abstracts.
/// </summary>
public record SearchHybridQuery : IRequest<SearchHybridResult>
{
    /// <summary>Natural language search query (will be converted to a vector).</summary>
    public string SearchText { get; init; } = string.Empty;

    /// <summary>Optional: Maximum planet mass in Earth masses.</summary>
    public double? MaxMassEarth { get; init; }

    /// <summary>Optional: Filter papers by discovery method of linked exoplanets.</summary>
    public string? DiscoveryMethod { get; init; }

    /// <summary>Number of results to return.</summary>
    public int Take { get; init; } = 10;
}

public record SearchHybridResult
{
    public List<PaperSearchHit> Papers { get; init; } = new();
}

public record PaperSearchHit
{
    public string Id { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Abstract { get; init; } = string.Empty;
    public DateTime PublishedDate { get; init; }
    public List<string> ExoplanetIds { get; init; } = new();
}
