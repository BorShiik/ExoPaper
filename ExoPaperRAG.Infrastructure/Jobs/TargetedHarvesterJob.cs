using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Infrastructure.Services;
using Microsoft.Extensions.Logging;
using Quartz;
using Raven.Client.Documents;

namespace ExoPaperRAG.Infrastructure.Jobs;

/// <summary>
/// Proactively searches arXiv for papers containing specific exoplanet names.
/// Processes a few planets at a time to respect arXiv rate limits.
/// </summary>
[DisallowConcurrentExecution]
public class TargetedHarvesterJob : IJob
{
    private readonly IArxivClient _arxivClient;
    private readonly IDocumentStore _store;
    private readonly ILogger<TargetedHarvesterJob> _logger;

    private const int BatchSize = 5;

    public TargetedHarvesterJob(
        IArxivClient arxivClient,
        IDocumentStore store,
        ILogger<TargetedHarvesterJob> logger)
    {
        _arxivClient = arxivClient;
        _store = store;
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        _logger.LogInformation("[TargetedHarvester] Job started.");
        var ct = context.CancellationToken;

        try
        {
            using var session = _store.OpenAsyncSession();
            session.Advanced.MaxNumberOfRequestsPerSession = 1000;
            
            // Get the oldest checked planets (or nulls)
            var planets = await session.Query<Exoplanet>()
                .OrderBy(x => x.LastTargetedHarvestUtc)
                .Take(BatchSize)
                .ToListAsync(ct);

            if (planets.Count == 0)
            {
                _logger.LogInformation("[TargetedHarvester] No planets found to process.");
                return;
            }

            int totalNewPapers = 0;

            foreach (var planet in planets)
            {
                ct.ThrowIfCancellationRequested();

                try
                {
                    _logger.LogInformation("[TargetedHarvester] Searching for planet: {Planet}", planet.Name);
                    
                    // Search arXiv for the exact planet name
                    var page = await _arxivClient.SearchRecordsAsync($"all:\"{planet.Name}\"", maxResults: 10, ct);

                    foreach (var record in page.Records)
                    {
                        if (string.IsNullOrWhiteSpace(record.ArxivId)) continue;

                        var paperId = $"papers/{record.ArxivId}";
                        var paper = await session.LoadAsync<Paper>(paperId, ct);

                        bool isNew = false;
                        if (paper == null)
                        {
                            isNew = true;
                            // Upsert authors
                            var authorIds = new List<string>();
                            foreach (var authorName in record.Authors)
                            {
                                var authorId = $"authors/{authorName.Replace(" ", "-").ToLowerInvariant()}";
                                var existingAuthor = await session.LoadAsync<Author>(authorId, ct);

                                if (existingAuthor == null)
                                {
                                    await session.StoreAsync(new Author
                                    {
                                        Id = authorId,
                                        Name = authorName,
                                        Affiliation = string.Empty
                                    }, ct);
                                }
                                authorIds.Add(authorId);
                            }

                            paper = new Paper
                            {
                                Id = paperId,
                                Title = record.Title,
                                Abstract = record.Abstract,
                                PublishedDate = record.Created,
                                AuthorIds = authorIds,
                                ExoplanetIds = new List<string>(),
                                HasEmbeddings = false,
                                ChunkCount = 0,
                                IsReviewed = false
                            };
                            await session.StoreAsync(paper, ct);
                            totalNewPapers++;
                        }

                        // Ensure this planet is linked to the paper
                        if (!paper.ExoplanetIds.Contains(planet.Id))
                        {
                            paper.ExoplanetIds.Add(planet.Id);
                            
                            // If the paper was already embedded but now gained a new link,
                            // we don't necessarily have to re-embed, but we mark it linked.
                        }
                    }

                    // Update the timestamp
                    planet.LastTargetedHarvestUtc = DateTime.UtcNow;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[TargetedHarvester] Failed to search for planet {Planet}", planet.Name);
                }
            }

            await session.SaveChangesAsync(ct);
            _logger.LogInformation("[TargetedHarvester] Job completed. Processed {Count} planets. Created {Papers} new papers.", planets.Count, totalNewPapers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TargetedHarvester] Job failed.");
            throw new JobExecutionException(ex, refireImmediately: false);
        }
    }
}
