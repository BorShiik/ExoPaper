using MediatR;

namespace ExoPaperRAG.Application.Features.Planets.Queries;

public record GetPlanetAiSummaryQuery : IRequest<PlanetAiSummaryResult>
{
    public required string ExoplanetId { get; init; }
    public bool Regenerate { get; init; }
}

public record PlanetAiSummaryResult
{
    public required string ExoplanetId { get; init; }
    public string? ExoplanetName { get; init; }

    /// <summary>Planet classification label (e.g. "Gas Giant", "Super-Earth").</summary>
    public string PlanetType { get; init; } = string.Empty;

    /// <summary>A short, high-level overview of the most important facts (3–4 sentences).</summary>
    public string ShortSummary { get; init; } = string.Empty;

    /// <summary>Bullet-point notable facts about the planet.</summary>
    public string KeyHighlights { get; init; } = string.Empty;

    /// <summary>Assessment of the planet's potential habitability.</summary>
    public string HabitabilityAssessment { get; init; } = string.Empty;

    /// <summary>How this planet compares to Earth and/or Jupiter.</summary>
    public string ComparativeContext { get; init; } = string.Empty;

    /// <summary>Discussion of atmosphere and climate conditions.</summary>
    public string AtmosphereClimate { get; init; } = string.Empty;

    /// <summary>Description of the orbital characteristics.</summary>
    public string OrbitalDynamics { get; init; } = string.Empty;

    /// <summary>Analysis of the host star.</summary>
    public string HostStarAnalysis { get; init; } = string.Empty;

    /// <summary>What the scientific literature says about this planet.</summary>
    public string LiteratureSynthesis { get; init; } = string.Empty;

    /// <summary>Frontier research areas and unanswered questions.</summary>
    public string OpenQuestions { get; init; } = string.Empty;

    /// <summary>Legacy field — full detailed prose (backward compat).</summary>
    public string DetailedSummary { get; init; } = string.Empty;
}
