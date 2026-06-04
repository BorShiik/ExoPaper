using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Raven.Client.Documents;
using Raven.Client.Documents.Subscriptions;
using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Application.Abstractions;

namespace ExoPaperRAG.Infrastructure.Workers;

/// <summary>
/// Background service that uses RavenDB Data Subscriptions to continuously
/// pick up papers without embeddings and vectorize them via Ollama.
/// Uses ACK pattern — subscription is acknowledged only after successful vector save.
/// </summary>
public class EmbeddingWorker : BackgroundService
{
    private readonly IDocumentStore _store;
    private readonly IOllamaClient _ollama;
    private readonly ILogger<EmbeddingWorker> _logger;
    private const string SubscriptionName = "PapersWithoutEmbeddings";

    public EmbeddingWorker(
        IDocumentStore store,
        IOllamaClient ollama,
        ILogger<EmbeddingWorker> logger)
    {
        _store = store;
        _ollama = ollama;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Ensure the subscription exists (idempotent — won't create a duplicate)
        await EnsureSubscriptionExistsAsync();

        _logger.LogInformation("[EmbeddingWorker] Starting RavenDB Data Subscription worker...");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessSubscriptionAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("[EmbeddingWorker] Worker shutting down gracefully.");
                break;
            }
            catch (Exception ex)
            {
                // If Ollama crashes (OOM, etc.), wait and retry. 
                // RavenDB won't ACK the batch, so nothing is lost.
                _logger.LogError(ex, "[EmbeddingWorker] Subscription error. Retrying in 30s...");
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }
    }

    private async Task EnsureSubscriptionExistsAsync()
    {
        try
        {
            // Try to get existing subscription state — if it exists, do nothing
            _store.Subscriptions.GetSubscriptionState(SubscriptionName);
            _logger.LogInformation("[EmbeddingWorker] Subscription '{Name}' already exists.", SubscriptionName);
        }
        catch
        {
            // Subscription doesn't exist — create it with a filter for non-embedded papers
            _store.Subscriptions.Create(new SubscriptionCreationOptions<Paper>
            {
                Name = SubscriptionName,
                Filter = paper => paper.HasEmbeddings == false
            });

            _logger.LogInformation("[EmbeddingWorker] Created subscription '{Name}'.", SubscriptionName);
        }
    }

    private async Task ProcessSubscriptionAsync(CancellationToken stoppingToken)
    {
        var worker = _store.Subscriptions.GetSubscriptionWorker<Paper>(
            new SubscriptionWorkerOptions(SubscriptionName)
            {
                MaxDocsPerBatch = 50,
                Strategy = SubscriptionOpeningStrategy.TakeOver
            });

        // This runs indefinitely until cancelled or an error occurs
        await worker.Run(async batch =>
        {
            _logger.LogInformation("[EmbeddingWorker] Received batch of {Count} papers.", batch.Items.Count);

            using var session = batch.OpenAsyncSession();

            foreach (var item in batch.Items)
            {
                var paper = item.Result;

                if (string.IsNullOrWhiteSpace(paper.Abstract))
                {
                    _logger.LogWarning("[EmbeddingWorker] Paper '{Id}' has no abstract, skipping.", paper.Id);
                    paper.HasEmbeddings = true; // Mark as processed to avoid re-processing
                    continue;
                }

                try
                {
                    // Call Ollama to generate embedding from the abstract text
                    var vector = await _ollama.GetEmbeddingAsync(paper.Abstract, stoppingToken);

                    paper.Vector = vector;
                    paper.HasEmbeddings = true;

                    _logger.LogDebug("[EmbeddingWorker] Vectorized paper '{Id}' ({Dim}D).", paper.Id, vector.Length);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[EmbeddingWorker] Failed to embed paper '{Id}'. Will retry in next batch.", paper.Id);
                    throw; // Re-throw so the batch is NOT acknowledged
                }
            }

            // ACK: Save all changes. If this succeeds, RavenDB marks the batch as processed.
            await session.SaveChangesAsync(stoppingToken);
            _logger.LogInformation("[EmbeddingWorker] Batch saved and acknowledged successfully.");

        }, stoppingToken);
    }
}
