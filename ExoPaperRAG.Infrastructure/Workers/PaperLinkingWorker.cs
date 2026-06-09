using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Infrastructure.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Raven.Client.Documents;
using Raven.Client.Documents.Subscriptions;
using Raven.Client.Exceptions.Documents.Subscriptions;

namespace ExoPaperRAG.Infrastructure.Workers;

/// <summary>
/// Entity-linking worker. Consumes a RavenDB Data Subscription of papers that have
/// not yet been linked, matches exoplanet names from the <see cref="ExoplanetGazetteer"/>
/// against the title/abstract, and stores the resulting links on the paper. This is
/// what powers "Linked Exoplanets" in the paper view and "Linked Publications" on the
/// planet page. Deterministic (no LLM) and idempotent.
/// </summary>
public sealed class PaperLinkingWorker : BackgroundService
{
    private readonly IDocumentStore _store;
    private readonly ExoplanetGazetteer _gazetteer;
    private readonly ILogger<PaperLinkingWorker> _logger;

    private const string SubscriptionName = "papers-pending-linking";

    public PaperLinkingWorker(
        IDocumentStore store,
        ExoplanetGazetteer gazetteer,
        ILogger<PaperLinkingWorker> logger)
    {
        _store = store;
        _gazetteer = gazetteer;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await EnsureSubscriptionAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _gazetteer.EnsureLoadedAsync(stoppingToken);

                // No exoplanets ingested yet → don't mark papers as processed; wait.
                if (_gazetteer.Count == 0)
                {
                    _logger.LogInformation("[PaperLinking] Gazetteer empty — waiting for NASA sync.");
                    await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
                    continue;
                }

                var options = new SubscriptionWorkerOptions(SubscriptionName)
                {
                    Strategy = SubscriptionOpeningStrategy.WaitForFree,
                    MaxDocsPerBatch = 50
                };

                await using var worker = _store.Subscriptions.GetSubscriptionWorker<Paper>(options);
                _logger.LogInformation("[PaperLinking] Subscription worker started.");
                await worker.Run(ProcessBatchAsync, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[PaperLinking] Subscription failed; restarting in 5s.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task ProcessBatchAsync(SubscriptionBatch<Paper> batch)
    {
        await _gazetteer.EnsureLoadedAsync(CancellationToken.None);

        using var session = batch.OpenAsyncSession();
        var linked = 0;

        foreach (var item in batch.Items)
        {
            var paper = item.Result;
            var ids = _gazetteer.Match(paper.Title, paper.Abstract);
            paper.SetExoplanetLinks(ids);
            if (ids.Count > 0)
                linked++;
        }

        await session.SaveChangesAsync();

        if (linked > 0)
            _logger.LogInformation("[PaperLinking] Linked {Linked}/{Total} papers in batch.",
                linked, batch.Items.Count);
    }

    private async Task EnsureSubscriptionAsync(CancellationToken ct)
    {
        try
        {
            await _store.Subscriptions.GetSubscriptionStateAsync(SubscriptionName, token: ct);
        }
        catch (SubscriptionDoesNotExistException)
        {
            await _store.Subscriptions.CreateAsync(new SubscriptionCreationOptions<Paper>
            {
                Name = SubscriptionName,
                // "!= true" also matches legacy documents created before this field existed.
                Filter = paper => paper.LinksProcessed != true
            }, token: ct);

            _logger.LogInformation("[PaperLinking] Created subscription '{Name}'.", SubscriptionName);
        }
    }
}
