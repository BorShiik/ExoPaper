using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Raven.Client.Documents;
using Raven.Client.Documents.Subscriptions;
using Raven.Client.Exceptions.Documents.Subscriptions;
using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Application.Abstractions;
using System.Text.Json;

namespace ExoPaperRAG.Infrastructure.Workers;

/// <summary>
/// Consumes a RavenDB Data Subscription of papers without embeddings, vectorizes
/// each via Ollama, stores the vector and an Outbox event. RavenDB delivers each
/// document until the batch is acknowledged, and the
/// <see cref="SubscriptionOpeningStrategy.WaitForFree"/> strategy ensures only one
/// consumer is active across all API instances (no duplicate work when scaled out).
/// </summary>
public sealed class EmbeddingWorker : BackgroundService
{
    private readonly IDocumentStore _store;
    private readonly IOllamaClient _ollama;
    private readonly ILogger<EmbeddingWorker> _logger;

    private const string SubscriptionName = "papers-without-embeddings";

    public EmbeddingWorker(IDocumentStore store, IOllamaClient ollama, ILogger<EmbeddingWorker> logger)
    {
        _store = store;
        _ollama = ollama;
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
                MaxDocsPerBatch = 25
            };

            await using var worker = _store.Subscriptions.GetSubscriptionWorker<Paper>(options);
            try
            {
                _logger.LogInformation("[EmbeddingWorker] Subscription worker started.");
                await worker.Run(ProcessBatchAsync, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[EmbeddingWorker] Subscription failed; restarting in 5s.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task ProcessBatchAsync(SubscriptionBatch<Paper> batch)
    {
        using var session = batch.OpenAsyncSession();

        foreach (var item in batch.Items)
        {
            var paper = item.Result;
            try
            {
                var textToEmbed = $"Title: {paper.Title}\nAbstract: {paper.Abstract}";
                var embedding = await _ollama.GetEmbeddingAsync(textToEmbed);

                if (embedding is { Length: > 0 })
                {
                    paper.SetEmbedding(embedding);

                    var payload = JsonSerializer.Serialize(new { PaperId = paper.Id, paper.Title });
                    await session.StoreAsync(new OutboxEvent
                    {
                        EventType = "PaperEmbedded",
                        PayloadJson = payload
                    });

                    _logger.LogDebug("[EmbeddingWorker] Embedded paper '{Id}'.", paper.Id);
                }
            }
            catch (Exception ex)
            {
                // Skip this document; it stays unembedded and is retried on a later pass.
                _logger.LogError(ex, "[EmbeddingWorker] Failed to embed paper '{Id}'.", paper.Id);
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
            await _store.Subscriptions.CreateAsync(new SubscriptionCreationOptions<Paper>
            {
                Name = SubscriptionName,
                Filter = paper => paper.HasEmbeddings == false
            }, token: ct);

            _logger.LogInformation("[EmbeddingWorker] Created subscription '{Name}'.", SubscriptionName);
        }
    }
}
