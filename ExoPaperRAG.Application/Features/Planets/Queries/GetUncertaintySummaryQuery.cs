using MediatR;
using ExoPaperRAG.Domain.Entities;

namespace ExoPaperRAG.Application.Features.Planets.Queries;

/// <summary>
/// Collects conflicting measurements for a planet and generates
/// an analytical summary using the LLM (Uncertainty Tracking).
/// </summary>
public record GetUncertaintySummaryQuery : IRequest<UncertaintySummaryResult>
{
    /// <summary>RavenDB document ID of the exoplanet (e.g. "exoplanets/Kepler-22b").</summary>
    public string ExoplanetId { get; init; } = string.Empty;

    /// <summary>When true, bypasses the cached summary and re-runs the LLM pipeline.</summary>
    public bool Regenerate { get; init; }
}

public record UncertaintySummaryResult
{
    public string ExoplanetId { get; init; } = string.Empty;
    public string ExoplanetName { get; init; } = string.Empty;
    public string AnalysisSummary { get; init; } = string.Empty;

    /// <summary>Data-driven per-parameter discrepancy analysis from published measurements (NASA "ps").</summary>
    public List<ParameterDisparity> Disparities { get; init; } = new();

    /// <summary>Secondary signal: papers that reference the planet (literature context).</summary>
    public List<ConflictingMeasurement> Conflicts { get; init; } = new();
}

public record ConflictingMeasurement
{
    public string PaperTitle { get; init; } = string.Empty;
    public string PaperId { get; init; } = string.Empty;
    public string RelevantText { get; init; } = string.Empty;
}
