using ExoPaperRAG.Domain.Entities;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;

namespace ExoPaperRAG.Infrastructure.Workers;

/// <summary>
/// Periodically purges dispatched <see cref="OutboxEvent"/> documents older than the
/// retention window, so the outbox collection does not grow without bound.
/// </summary>
public sealed class OutboxCleanupService : BackgroundService
{
    private readonly IDocumentStore _store;
    private readonly ILogger<OutboxCleanupService> _logger;

    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    private static readonly TimeSpan Retention = TimeSpan.FromHours(24);
    private const int PageSize = 512;

    public OutboxCleanupService(IDocumentStore store, ILogger<OutboxCleanupService> logger)
    {
        _store = store;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var removed = await PurgeAsync(stoppingToken);
                if (removed > 0)
                    _logger.LogInformation("[OutboxCleanup] Removed {Count} dispatched events.", removed);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[OutboxCleanup] Cleanup pass failed.");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task<int> PurgeAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow - Retention;
        var total = 0;

        while (!ct.IsCancellationRequested)
        {
            using var session = _store.OpenAsyncSession();
            var stale = await session.Query<OutboxEvent>()
                .Where(e => e.Dispatched && e.CreatedAt < cutoff)
                .Take(PageSize)
                .ToListAsync(ct);

            if (stale.Count == 0)
                break;

            foreach (var evt in stale)
                session.Delete(evt);

            await session.SaveChangesAsync(ct);
            total += stale.Count;

            if (stale.Count < PageSize)
                break;
        }

        return total;
    }
}
