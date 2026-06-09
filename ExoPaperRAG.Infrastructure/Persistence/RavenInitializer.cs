using System.Net.Http;
using System.Text.Json;
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

    private const int MaxAttempts = 30;
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
                var memberCount = await EnsureClusterIsFormedAsync(cancellationToken);
                await EnsureDatabaseExistsAsync(memberCount, cancellationToken);
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

    /// <summary>
    /// Forms (or rejoins) the RavenDB cluster across every configured node and returns the
    /// number of full members.
    ///
    /// A fresh node (<c>Setup_Mode=None</c> with an empty data volume — e.g. after
    /// <c>docker compose down -v</c>) boots in the <i>passive</i> state and rejects every
    /// database operation with <see cref="Raven.Client.Exceptions.Cluster.NodeIsPassiveException"/>.
    /// The .NET client never promotes a node on its own, so we:
    ///   1. bootstrap the first node out of passive (it becomes the leader of a 1-node cluster), then
    ///   2. add every other configured node to that cluster as a full member.
    /// Both steps are idempotent — calling them once the cluster already exists is a harmless no-op,
    /// so this survives restarts and partial failures via the caller's retry loop.
    /// </summary>
    private async Task<int> EnsureClusterIsFormedAsync(CancellationToken ct)
    {
        var nodes = _store.Urls.Select(u => u.TrimEnd('/')).ToArray();
        var leader = nodes[0];
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

        // 1) Promote the leader out of the passive state.
        var bootstrapped = await http.PostAsync($"{leader}/admin/cluster/bootstrap", null, ct);
        if (bootstrapped.IsSuccessStatusCode)
            _logger.LogInformation("Bootstrapped RavenDB leader '{Url}'.", leader);
        else
            _logger.LogDebug("Bootstrap returned {Status} for '{Url}' (likely already active).",
                (int)bootstrapped.StatusCode, leader);

        // 2) Add the remaining nodes. Adding an existing member returns an error we ignore.
        foreach (var node in nodes.Skip(1))
        {
            var addUrl = $"{leader}/admin/cluster/node?url={Uri.EscapeDataString(node)}";
            try
            {
                var added = await http.PutAsync(addUrl, null, ct);
                if (added.IsSuccessStatusCode)
                    _logger.LogInformation("Added RavenDB node '{Url}' to the cluster.", node);
                else
                    _logger.LogDebug("Add-node returned {Status} for '{Url}' (likely already a member).",
                        (int)added.StatusCode, node);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogDebug(ex, "Add-node call for '{Url}' failed; will retry.", node);
            }
        }

        // 3) Newly added nodes start as "promotables" and take a few seconds to be promoted
        //    to full members. Wait (bounded) for the topology to converge so the database is
        //    created with the right replication factor instead of RF=1 on a still-forming cluster.
        var target = nodes.Length;
        var members = await GetMemberCountAsync(http, leader, ct);
        var waited = TimeSpan.Zero;
        var poll = TimeSpan.FromSeconds(2);
        while (members < target && waited < TimeSpan.FromSeconds(20))
        {
            await Task.Delay(poll, ct);
            waited += poll;
            members = await GetMemberCountAsync(http, leader, ct);
        }

        if (members < target)
            _logger.LogWarning(
                "Cluster has {Members}/{Target} members after waiting; proceeding with RF={Members}.",
                members, target, members);

        return Math.Max(1, members);
    }

    /// <summary>Reads <c>/cluster/topology</c> and counts the full members.</summary>
    private async Task<int> GetMemberCountAsync(HttpClient http, string leader, CancellationToken ct)
    {
        try
        {
            var json = await http.GetStringAsync($"{leader}/cluster/topology", ct);
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("Topology", out var topology) &&
                topology.TryGetProperty("Members", out var members) &&
                members.ValueKind == JsonValueKind.Object)
            {
                return members.EnumerateObject().Count();
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogDebug(ex, "Could not read cluster topology from '{Url}'.", leader);
        }
        return 1;
    }

    private async Task EnsureDatabaseExistsAsync(int replicationFactor, CancellationToken ct)
    {
        try
        {
            await _store.Maintenance.ForDatabase(_store.Database)
                .SendAsync(new GetStatisticsOperation(), ct);
        }
        catch (DatabaseDoesNotExistException)
        {
            _logger.LogInformation(
                "Database '{Database}' does not exist — creating it with replication factor {Rf}.",
                _store.Database, replicationFactor);
            try
            {
                await _store.Maintenance.Server.SendAsync(
                    new CreateDatabaseOperation(new DatabaseRecord(_store.Database), replicationFactor), ct);
            }
            catch (ConcurrencyException)
            {
                // Another instance created the database first — that's fine.
            }
        }
    }
}
