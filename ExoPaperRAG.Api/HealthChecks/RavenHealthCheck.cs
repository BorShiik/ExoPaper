using Microsoft.Extensions.Diagnostics.HealthChecks;
using Raven.Client.Documents;
using Raven.Client.Documents.Operations;

namespace ExoPaperRAG.Api.HealthChecks;

/// <summary>Reports the API as unhealthy when the RavenDB database is unreachable.</summary>
public sealed class RavenHealthCheck : IHealthCheck
{
    private readonly IDocumentStore _store;

    public RavenHealthCheck(IDocumentStore store) => _store = store;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var stats = await _store.Maintenance.ForDatabase(_store.Database)
                .SendAsync(new GetStatisticsOperation(), cancellationToken);

            return HealthCheckResult.Healthy(
                $"RavenDB reachable ({stats.CountOfDocuments} documents).");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("RavenDB unreachable.", ex);
        }
    }
}
