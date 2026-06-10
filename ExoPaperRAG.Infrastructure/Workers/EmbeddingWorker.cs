using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Raven.Client.Documents;
using Raven.Client.Documents.Subscriptions;
using Raven.Client.Exceptions.Documents.Subscriptions;
using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Application.Abstractions;
using System.Text.Json;
using HtmlAgilityPack;
using System.Text.RegularExpressions;

namespace ExoPaperRAG.Infrastructure.Workers;

/// <summary>
/// Consumes a RavenDB Data Subscription of papers without embeddings, fetches the 
/// full text HTML from arXiv (falling back to abstract), chunks the text,
/// vectorizes each chunk via Ollama, and stores the chunks.
/// </summary>
public sealed class EmbeddingWorker : BackgroundService
{
    private readonly IDocumentStore _store;
    private readonly IOllamaClient _ollama;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<EmbeddingWorker> _logger;

    private const string SubscriptionName = "papers-without-embeddings";

    public EmbeddingWorker(IDocumentStore store, IOllamaClient ollama, IHttpClientFactory httpClientFactory, ILogger<EmbeddingWorker> logger)
    {
        _store = store;
        _ollama = ollama;
        _httpClientFactory = httpClientFactory;
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
                string textToChunk = await GetPaperTextAsync(paper);

                var chunks = ChunkText(textToChunk, 1000, 200).ToList();

                // Remove any previously stored chunk documents (deterministic ids) so a re-embed
                // doesn't leave orphans. Chunks are separate documents — the Paper stays small.
                for (int i = 0; i < paper.ChunkCount; i++)
                    session.Delete(Paper.ChunkId(paper.Id, i));

                var stored = 0;
                for (int i = 0; i < chunks.Count; i++)
                {
                    var chunkText = chunks[i];
                    var embedding = await _ollama.GetEmbeddingAsync(chunkText);

                    if (embedding is { Length: > 0 })
                    {
                        var chunkId = Paper.ChunkId(paper.Id, stored);
                        await session.StoreAsync(new PaperChunk
                        {
                            Id = chunkId,
                            PaperId = paper.Id,
                            Index = stored,
                            Text = chunkText,
                            Vector = embedding
                        }, chunkId);
                        stored++;
                    }
                }

                paper.SetEmbedded(stored);

                if (stored > 0)
                {
                    var payload = JsonSerializer.Serialize(new { PaperId = paper.Id, paper.Title });
                    await session.StoreAsync(new OutboxEvent
                    {
                        EventType = "PaperEmbedded",
                        PayloadJson = payload
                    });

                    _logger.LogInformation("[EmbeddingWorker] Embedded paper '{Id}' into {Count} chunk document(s).", paper.Id, stored);
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

    private async Task<string> GetPaperTextAsync(Paper paper)
    {
        string arxivId = paper.Id.Replace("papers/", "");
        // Try to fetch HTML
        if (!string.IsNullOrWhiteSpace(arxivId))
        {
            try
            {
                // Delay to respect arXiv rate limits loosely
                await Task.Delay(1000);
                
                using var http = _httpClientFactory.CreateClient();
                // We use a short timeout so we don't stall the subscription worker if ar5iv is slow
                http.Timeout = TimeSpan.FromSeconds(10);
                
                var url = $"https://arxiv.org/html/{arxivId}";
                var response = await http.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    var html = await response.Content.ReadAsStringAsync();
                    var doc = new HtmlDocument();
                    doc.LoadHtml(html);
                    
                    var text = doc.DocumentNode.InnerText;
                    text = Regex.Replace(text, @"\s+", " ").Trim();
                    
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        _logger.LogInformation("[EmbeddingWorker] Downloaded HTML full text for {ArxivId}", arxivId);
                        return $"Title: {paper.Title}\nContent: {text}";
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[EmbeddingWorker] Failed to fetch HTML for {ArxivId}, falling back to abstract.", arxivId);
            }
        }

        // Fallback to Abstract
        return $"Title: {paper.Title}\nAbstract: {paper.Abstract}";
    }

    private static IEnumerable<string> ChunkText(string text, int maxChunkSize, int overlap)
    {
        if (string.IsNullOrWhiteSpace(text)) yield break;

        int i = 0;
        while (i < text.Length)
        {
            int length = Math.Min(maxChunkSize, text.Length - i);
            yield return text.Substring(i, length);
            i += maxChunkSize - overlap;
        }
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
