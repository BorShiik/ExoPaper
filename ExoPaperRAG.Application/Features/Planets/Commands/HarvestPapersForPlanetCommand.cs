using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Application.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ExoPaperRAG.Application.Features.Planets.Commands;

/// <summary>Triggers an on-demand arXiv harvest for a single planet and returns how many papers were linked.</summary>
public record HarvestPapersForPlanetCommand(string ExoplanetId) : IRequest<HarvestPapersResult>;

public record HarvestPapersResult
{
    public int LinkedCount { get; init; }
    public string Message { get; init; } = string.Empty;
}

public class HarvestPapersForPlanetCommandHandler
    : IRequestHandler<HarvestPapersForPlanetCommand, HarvestPapersResult>
{
    private readonly ITargetedPaperHarvester _harvester;
    private readonly ILogger<HarvestPapersForPlanetCommandHandler> _logger;

    public HarvestPapersForPlanetCommandHandler(
        ITargetedPaperHarvester harvester,
        ILogger<HarvestPapersForPlanetCommandHandler> logger)
    {
        _harvester = harvester;
        _logger = logger;
    }

    public async Task<HarvestPapersResult> Handle(HarvestPapersForPlanetCommand request, CancellationToken ct)
    {
        var docId = RavenIds.EnsurePrefix(request.ExoplanetId, "exoplanets/");

        try
        {
            var linked = await _harvester.HarvestForPlanetAsync(docId, ct);
            return new HarvestPapersResult
            {
                LinkedCount = linked,
                Message = linked > 0
                    ? $"Linked {linked} paper(s). They will become searchable once embedded."
                    : "No new papers found for this planet on arXiv."
            };
        }
        catch (Exception ex)
        {
            // Never surface a 500 to the UI for a best-effort enrichment action.
            _logger.LogWarning(ex, "Targeted harvest failed for '{Id}'.", docId);
            return new HarvestPapersResult
            {
                LinkedCount = 0,
                Message = "arXiv search is temporarily unavailable. Please try again later."
            };
        }
    }
}
