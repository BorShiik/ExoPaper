using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Domain.Entities;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Raven.Client.Documents;
using Raven.Client.Documents.Subscriptions;
using Raven.Client.Exceptions.Documents.Subscriptions;

namespace ExoPaperRAG.Infrastructure.Workers;

/// <summary>
/// Transactional Outbox dispatcher. Consumes a RavenDB Data Subscription of
/// undispatched <see cref="OutboxEvent"/> documents and forwards them to the
/// real-time notifier (SignalR), marking each as dispatched. At-least-once
/// delivery: if the broadcast succeeds but the ack fails, the event is redelivered.
/// </summary>
public sealed class OutboxDispatcher : BackgroundService
{
    private readonly IDocumentStore _store;
    private readonly IRealtimeNotifier _notifier;
    private readonly ILogger<OutboxDispatcher> _logger;

    private const string SubscriptionName = "outbox-undispatched";

    public OutboxDispatcher(IDocumentStore store, IRealtimeNotifier notifier, ILogger<OutboxDispatcher> logger)
    {
        _store = store;
        _notifier = notifier;
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

            await using var worker = _store.Subscriptions.GetSubscriptionWorker<OutboxEvent>(options);
            try
            {
                _logger.LogInformation("[OutboxDispatcher] Subscription worker started.");
                await worker.Run(ProcessBatchAsync, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[OutboxDispatcher] Subscription failed; restarting in 5s.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task ProcessBatchAsync(SubscriptionBatch<OutboxEvent> batch)
    {
        using var session = batch.OpenAsyncSession();

        foreach (var item in batch.Items)
        {
            var evt = item.Result;
            try
            {
                await _notifier.BroadcastEventAsync(evt.EventType, evt.PayloadJson);
                evt.Dispatched = true;
                _logger.LogDebug("[OutboxDispatcher] Dispatched '{Id}'.", evt.Id);
            }
            catch (Exception ex)
            {
                // Leave Dispatched = false → redelivered on a later batch.
                _logger.LogError(ex, "[OutboxDispatcher] Failed to dispatch '{Id}'.", evt.Id);
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
            await _store.Subscriptions.CreateAsync(new SubscriptionCreationOptions<OutboxEvent>
            {
                Name = SubscriptionName,
                Filter = e => e.Dispatched == false
            }, token: ct);

            _logger.LogInformation("[OutboxDispatcher] Created subscription '{Name}'.", SubscriptionName);
        }
    }
}
