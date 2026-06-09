using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Infrastructure.Services;
using ExoPaperRAG.Infrastructure.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Quartz;
using Raven.Client.Documents;

namespace ExoPaperRAG.Infrastructure.Jobs;

/// <summary>
/// Quartz.NET job that harvests scientific paper abstracts from arXiv via OAI-PMH protocol.
/// 
/// Strategy:
/// - Reads SyncTracker for last harvest date.
/// - Fetches new/updated papers since that date using OAI-PMH ListRecords.
/// - Follows resumptionToken pagination up to MaxPagesPerRun.
/// - Upserts Paper documents. If a paper is re-harvested (new version), HasEmbeddings is reset to false.
/// - Creates Author documents as a side-effect (for the Include() requirement).
/// </summary>
[DisallowConcurrentExecution]
public class ArxivHarvesterJob : IJob
{
    private readonly IArxivClient _arxivClient;
    private readonly IDocumentStore _store;
    private readonly ArxivSettings _settings;
    private readonly ILogger<ArxivHarvesterJob> _logger;

    private const string ProviderId = "Arxiv";
    private const int BatchSize = 25;

    public ArxivHarvesterJob(
        IArxivClient arxivClient,
        IDocumentStore store,
        IOptions<ArxivSettings> settings,
        ILogger<ArxivHarvesterJob> logger)
    {
        _arxivClient = arxivClient;
        _store = store;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        _logger.LogInformation("[ArxivHarvester] Job started.");
        var ct = context.CancellationToken;

        try
        {
            using var session = _store.OpenAsyncSession();
            var tracker = await session.LoadAsync<SyncTracker>($"SyncTrackers/{ProviderId}", ct);

            DateTime? fromDate = null;
            if (tracker == null)
            {
                tracker = SyncTracker.CreateForProvider(ProviderId);
                await session.StoreAsync(tracker, ct);
                await session.SaveChangesAsync(ct);
                fromDate = DateTime.UtcNow.AddYears(-1);
                _logger.LogInformation("[ArxivHarvester] First run — harvesting papers from the last 1 year.");
            }
            else if (tracker.LastSyncUtc > DateTime.MinValue)
            {
                fromDate = tracker.LastSyncUtc.Date;
                _logger.LogInformation("[ArxivHarvester] Incremental harvest from {Date}", fromDate.Value.ToString("yyyy-MM-dd"));
            }
            else
            {
                // If it was created but never succeeded, also use 1 year ago
                fromDate = DateTime.UtcNow.AddYears(-1);
            }

            int totalRecords = 0;
            int pageCount = 0;

            // First page
            var page = await _arxivClient.ListRecordsAsync(fromDate, ct);
            totalRecords += await UpsertRecordsAsync(page.Records, ct);
            pageCount++;

            // Follow resumption tokens (pagination)
            while (page.ResumptionToken != null && pageCount < _settings.MaxPagesPerRun)
            {
                ct.ThrowIfCancellationRequested();

                _logger.LogInformation("[ArxivHarvester] Following resumptionToken, page {Page}/{Max}",
                    pageCount + 1, _settings.MaxPagesPerRun);

                page = await _arxivClient.ListRecordsAsync(page.ResumptionToken, ct);
                totalRecords += await UpsertRecordsAsync(page.Records, ct);
                pageCount++;
            }

            // Update tracker
            using var updateSession = _store.OpenAsyncSession();
            var freshTracker = await updateSession.LoadAsync<SyncTracker>($"SyncTrackers/{ProviderId}", ct);
            if (freshTracker != null)
            {
                freshTracker.MarkSuccess(totalRecords);
                await updateSession.SaveChangesAsync(ct);
            }

            _logger.LogInformation("[ArxivHarvester] Job completed. Pages: {Pages}, Records upserted: {Count}",
                pageCount, totalRecords);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ArxivHarvester] Job failed.");

            // Try to persist error info
            try
            {
                using var errorSession = _store.OpenAsyncSession();
                var errorTracker = await errorSession.LoadAsync<SyncTracker>($"SyncTrackers/{ProviderId}", ct);
                errorTracker?.MarkError(ex.Message);
                await errorSession.SaveChangesAsync(ct);
            }
            catch { /* don't mask original exception */ }

            throw new JobExecutionException(ex, refireImmediately: false);
        }
    }

    /// <summary>
    /// Upserts arXiv records into RavenDB as Paper + Author documents.
    /// </summary>
    private async Task<int> UpsertRecordsAsync(List<ArxivRecord> records, CancellationToken ct)
    {
        int count = 0;

        for (int i = 0; i < records.Count; i += BatchSize)
        {
            using var session = _store.OpenAsyncSession();
            session.Advanced.MaxNumberOfRequestsPerSession = 1000;
            var batch = records.Skip(i).Take(BatchSize);

            foreach (var record in batch)
            {
                if (string.IsNullOrWhiteSpace(record.ArxivId))
                    continue;

                // Upsert authors and collect their IDs
                var authorIds = new List<string>();
                foreach (var authorName in record.Authors)
                {
                    var authorId = $"authors/{authorName.Replace(" ", "-").ToLowerInvariant()}";
                    var existingAuthor = await session.LoadAsync<Author>(authorId, ct);

                    if (existingAuthor == null)
                    {
                        var author = new Author
                        {
                            Id = authorId,
                            Name = authorName,
                            Affiliation = string.Empty // arXiv OAI-PMH doesn't reliably provide affiliation
                        };
                        await session.StoreAsync(author, ct);
                    }

                    authorIds.Add(authorId);
                }

                // Build Paper document
                // ID uses the arXiv ID (e.g., "papers/2301.12345")
                var paperId = $"papers/{record.ArxivId}";

                var paper = new Paper
                {
                    Id = paperId,
                    Title = record.Title,
                    Abstract = record.Abstract,
                    PublishedDate = record.Created,
                    AuthorIds = authorIds,
                    ExoplanetIds = new List<string>(), // will be populated by future NLP pipeline
                    HasEmbeddings = false,  // CRITICAL: reset on every upsert — triggers re-vectorization
                    Vector = Array.Empty<float>(),
                    IsReviewed = false
                };

                await session.StoreAsync(paper, paper.Id, ct);
                count++;
            }

            await session.SaveChangesAsync(ct);
        }

        return count;
    }
}
