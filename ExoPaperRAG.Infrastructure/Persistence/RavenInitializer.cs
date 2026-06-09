using ExoPaperRAG.Application.Indexes;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Raven.Client.Documents;
using Raven.Client.Documents.Indexes;
using Raven.Client.Documents.Operations;
using Raven.Client.Exceptions;
using Raven.Client.Exceptions.Database;
using Raven.Client.ServerWide;
using Raven.Client.ServerWide.Operations;

namespace ExoPaperRAG.Infrastructure.Persistence;

/// <summary>
/// Ensures the RavenDB database exists and all index definitions are deployed
/// before the rest of the application starts. Runs once at startup with bounded
/// retries so the API can boot alongside a RavenDB container that is still warming up.
///
/// Registered as the first <see cref="IHostedService"/> so it completes before the
/// background workers (which query those indexes) begin.
/// </summary>
public sealed class RavenInitializer : IHostedService
{
    private readonly IDocumentStore _store;
    private readonly ILogger<RavenInitializer> _logger;

    private const int MaxAttempts = 10;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(3);

    public RavenInitializer(IDocumentStore store, ILogger<RavenInitializer> logger)
    {
        _store = store;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            try
            {
                await EnsureDatabaseExistsAsync(cancellationToken);
                await IndexCreation.CreateIndexesAsync(
                    typeof(Exoplanets_ByHabitability).Assembly, _store, token: cancellationToken);

                _logger.LogInformation(
                    "RavenDB ready: database '{Database}' and indexes are deployed.", _store.Database);
                return;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "RavenDB initialization attempt {Attempt}/{Max} failed; retrying in {Delay}s.",
                    attempt, MaxAttempts, RetryDelay.TotalSeconds);
                await Task.Delay(RetryDelay, cancellationToken);
            }
        }

        throw new InvalidOperationException(
            $"Failed to initialize RavenDB after {MaxAttempts} attempts.");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private async Task EnsureDatabaseExistsAsync(CancellationToken ct)
    {
        try
        {
            await _store.Maintenance.ForDatabase(_store.Database)
                .SendAsync(new GetStatisticsOperation(), ct);
        }
        catch (DatabaseDoesNotExistException)
        {
            _logger.LogInformation("Database '{Database}' does not exist — creating it.", _store.Database);
            try
            {
                await _store.Maintenance.Server.SendAsync(
                    new CreateDatabaseOperation(new DatabaseRecord(_store.Database)), ct);
            }
            catch (ConcurrencyException)
            {
                // Another instance created the database first — that's fine.
            }
        }
    }
}
