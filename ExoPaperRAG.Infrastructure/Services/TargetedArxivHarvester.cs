using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Infrastructure.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Raven.Client.Documents;
using Raven.Client.Documents.Session;

namespace ExoPaperRAG.Infrastructure.Services;

/// <summary>
/// On-demand targeted harvester: searches the arXiv Search API for a single planet using its
/// name plus all known aliases (host star, HD/HIP/TIC/Gaia designations), upserts the matching
/// papers, and links them straight to the planet. The embedding worker then vectorizes them so
/// they become available to RAG / synthesis.
/// </summary>
public sealed class TargetedArxivHarvester : ITargetedPaperHarvester
{
    private readonly IArxivClient _arxiv;
    private readonly IDocumentStore _store;
    private readonly ArxivSettings _settings;
    private readonly ILogger<TargetedArxivHarvester> _logger;

    public TargetedArxivHarvester(
        IArxivClient arxiv,
        IDocumentStore store,
        IOptions<ArxivSettings> settings,
        ILogger<TargetedArxivHarvester> logger)
    {
        _arxiv = arxiv;
        _store = store;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<int> HarvestForPlanetAsync(string exoplanetDocId, CancellationToken ct = default)
    {
        using var session = _store.OpenAsyncSession();
        session.Advanced.MaxNumberOfRequestsPerSession = 1000;

        var planet = await session.LoadAsync<Exoplanet>(exoplanetDocId, ct);
        if (planet is null)
        {
            _logger.LogWarning("[TargetedHarvest] Planet '{Id}' not found.", exoplanetDocId);
            return 0;
        }

        var query = BuildSearchQuery(planet);
        _logger.LogInformation("[TargetedHarvest] Searching arXiv for '{Planet}': {Query}", planet.Name, query);

        var page = await _arxiv.SearchRecordsAsync(query, _settings.TargetedMaxResults, ct);

        var linked = 0;
        foreach (var record in page.Records)
        {
            if (string.IsNullOrWhiteSpace(record.ArxivId))
                continue;

            var paperId = $"papers/{record.ArxivId}";
            var paper = await session.LoadAsync<Paper>(paperId, ct);

            if (paper is null)
            {
                var authorIds = await UpsertAuthorsAsync(session, record.Authors, ct);
                paper = Paper.Create(paperId, record.Title, record.Abstract, record.Created, authorIds);
                await session.StoreAsync(paper, paper.Id, ct);
            }

            if (!paper.ExoplanetIds.Contains(planet.Id))
            {
                var ids = paper.ExoplanetIds.ToList();
                ids.Add(planet.Id);
                paper.SetExoplanetLinks(ids); // distinct + marks LinksProcessed
                linked++;
            }
        }

        planet.LastTargetedHarvestUtc = DateTime.UtcNow;
        await session.SaveChangesAsync(ct);

        _logger.LogInformation("[TargetedHarvest] '{Planet}': {Linked} paper(s) linked.", planet.Name, linked);
        return linked;
    }

    /// <summary>
    /// Builds an arXiv search_query OR-combining the planet name and a few aliases, so papers
    /// that reference the host star (e.g. "GQ Lupi") rather than the planet designation
    /// ("GQ Lup b") are still found.
    /// </summary>
    private static string BuildSearchQuery(Exoplanet planet)
    {
        var terms = new List<string> { planet.Name };
        if (planet.Aliases is { Count: > 0 })
            terms.AddRange(planet.Aliases);

        var distinct = terms
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(5);

        return string.Join(" OR ", distinct.Select(t => $"all:\"{t}\""));
    }

    private static async Task<List<string>> UpsertAuthorsAsync(
        IAsyncDocumentSession session, List<string> authors, CancellationToken ct)
    {
        var ids = new List<string>();
        foreach (var name in authors)
        {
            if (string.IsNullOrWhiteSpace(name)) continue;

            var id = $"authors/{name.Replace(" ", "-").ToLowerInvariant()}";
            var existing = await session.LoadAsync<Author>(id, ct);
            if (existing is null)
                await session.StoreAsync(new Author { Id = id, Name = name, Affiliation = string.Empty }, ct);

            ids.Add(id);
        }
        return ids;
    }
}
