using System.Text.Json;
using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Domain.Rules;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Raven.Client.Documents;
using Raven.Client.Documents.Subscriptions;
using Raven.Client.Exceptions.Documents.Subscriptions;

namespace ExoPaperRAG.Infrastructure.Workers;

/// <summary>
/// Consumes a RavenDB Data Subscription of exoplanets that still need tagging,
/// applies the configured <see cref="IExoplanetTaggingRule"/> set, persists the
/// resulting tags and emits an Outbox event when tags actually change.
/// </summary>
public sealed class TaggingWorker : BackgroundService
{
    private readonly IDocumentStore _store;
    private readonly IEnumerable<IExoplanetTaggingRule> _rules;
    private readonly ILogger<TaggingWorker> _logger;

    private const string SubscriptionName = "exoplanets-pending-tagging";

    public TaggingWorker(
        IDocumentStore store,
        IEnumerable<IExoplanetTaggingRule> rules,
        ILogger<TaggingWorker> logger)
    {
        _store = store;
        _rules = rules;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await EnsureSubscriptionAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var options = new SubscriptionWorkerOptions(SubscriptionName)
            {
                Strategy = SubscriptionOpeningStrategy.WaitForFree,
                MaxDocsPerBatch = 100
            };

            await using var worker = _store.Subscriptions.GetSubscriptionWorker<Exoplanet>(options);
            try
            {
                _logger.LogInformation("[TaggingWorker] Subscription worker started.");
                await worker.Run(ProcessBatchAsync, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TaggingWorker] Subscription failed; restarting in 5s.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task ProcessBatchAsync(SubscriptionBatch<Exoplanet> batch)
    {
        using var session = batch.OpenAsyncSession();

        foreach (var item in batch.Items)
        {
            var planet = item.Result;

            var newTags = _rules.Where(rule => rule.IsMatch(planet))
                                 .Select(rule => rule.TagName)
                                 .ToList();

            var tagsChanged = planet.Tags.Count != newTags.Count
                              || !planet.Tags.All(newTags.Contains);

            if (tagsChanged)
                planet.Tags = newTags;

            planet.TagsProcessed = true;

            if (tagsChanged)
            {
                var payload = JsonSerializer.Serialize(new { PlanetId = planet.Id, Tags = planet.Tags });
                await session.StoreAsync(new OutboxEvent
                {
                    EventType = "ExoplanetTagged",
                    PayloadJson = payload
                });

                _logger.LogDebug("[TaggingWorker] '{Id}' tagged [{Tags}].",
                    planet.Id, string.Join(", ", planet.Tags));
            }
        }

        await session.SaveChangesAsync();
    }

    private async Task EnsureSubscriptionAsync(CancellationToken ct)
    {
        try
        {
            await _store.Subscriptions.GetSubscriptionStateAsync(SubscriptionName, token: ct);
        }
        catch (SubscriptionDoesNotExistException)
        {
            await _store.Subscriptions.CreateAsync(new SubscriptionCreationOptions<Exoplanet>
            {
                Name = SubscriptionName,
                Filter = planet => planet.TagsProcessed == false
            }, token: ct);

            _logger.LogInformation("[TaggingWorker] Created subscription '{Name}'.", SubscriptionName);
        }
    }
}
