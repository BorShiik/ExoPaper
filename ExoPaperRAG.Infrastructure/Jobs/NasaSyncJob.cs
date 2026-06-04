using ExoPaperRAG.Domain;
using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Infrastructure.Models;
using ExoPaperRAG.Infrastructure.Services;
using Microsoft.Extensions.Logging;
using Quartz;
using Raven.Client.Documents;

namespace ExoPaperRAG.Infrastructure.Jobs;

/// <summary>
/// Quartz.NET job that performs both initial seeding and incremental sync
/// of exoplanet data from NASA Exoplanet Archive TAP API.
/// 
/// Strategy:
/// - If SyncTracker document doesn't exist → Full Seeding (all ~6200+ planets with pagination).
/// - If SyncTracker exists → Incremental Sync (only planets updated since last sync).
/// </summary>
[DisallowConcurrentExecution]
public class NasaSyncJob : IJob
{
    private readonly INasaClient _nasaClient;
    private readonly IDocumentStore _store;
    private readonly ILogger<NasaSyncJob> _logger;

    private const string ProviderId = "Nasa";
    private const int PageSize = 2000; // TAP API max recommended batch

    public NasaSyncJob(INasaClient nasaClient, IDocumentStore store, ILogger<NasaSyncJob> logger)
    {
        _nasaClient = nasaClient;
        _store = store;
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        _logger.LogInformation("[NasaSync] Job started.");
        var ct = context.CancellationToken;

        try
        {
            using var session = _store.OpenAsyncSession();
            var tracker = await session.LoadAsync<SyncTracker>($"SyncTrackers/{ProviderId}", ct);

            if (tracker == null)
            {
                // First run ever — seed the full catalog
                tracker = SyncTracker.CreateForProvider(ProviderId);
                await session.StoreAsync(tracker, ct);
                await session.SaveChangesAsync(ct);

                await SeedFullCatalogAsync(tracker, ct);
            }
            else
            {
                // Incremental sync — only fetch updated records
                await IncrementalSyncAsync(tracker, ct);
            }

            _logger.LogInformation("[NasaSync] Job completed. Total documents synced to date: {Count}", tracker.TotalDocumentsSynced);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NasaSync] Job failed.");
            throw new JobExecutionException(ex, refireImmediately: false);
        }
    }

    /// <summary>
    /// Downloads the entire NASA exoplanet catalog using paginated ADQL queries.
    /// </summary>
    private async Task SeedFullCatalogAsync(SyncTracker tracker, CancellationToken ct)
    {
        _logger.LogInformation("[NasaSync] Starting full catalog seeding...");
        int offset = 0;
        int totalUpserted = 0;

        while (true)
        {
            ct.ThrowIfCancellationRequested();

            var query = BuildSelectQuery()
                .Top(PageSize)
                .Build();

            // NASA TAP doesn't support OFFSET natively in all versions,
            // but pscomppars supports it. We use a workaround: order by name and skip.
            // For simplicity, we append OFFSET manually.
            var pagedQuery = $"{query} OFFSET {offset}";

            _logger.LogInformation("[NasaSync] Fetching page: OFFSET={Offset}, TOP={Top}", offset, PageSize);

            var dtos = await _nasaClient.FetchPlanetAcync(pagedQuery, ct);

            if (dtos.Count == 0)
            {
                _logger.LogInformation("[NasaSync] No more records. Seeding complete.");
                break;
            }

            var upserted = await UpsertPlanetsAsync(dtos, ct);
            totalUpserted += upserted;
            offset += dtos.Count;

            _logger.LogInformation("[NasaSync] Upserted {Count} planets (total so far: {Total})", upserted, totalUpserted);
        }

        // Update tracker
        using var session = _store.OpenAsyncSession();
        var freshTracker = await session.LoadAsync<SyncTracker>($"SyncTrackers/{ProviderId}", ct);
        if (freshTracker != null)
        {
            freshTracker.MarkSuccess(totalUpserted);
            await session.SaveChangesAsync(ct);
        }
    }

    /// <summary>
    /// Fetches only planets that have been updated since the last sync.
    /// </summary>
    private async Task IncrementalSyncAsync(SyncTracker tracker, CancellationToken ct)
    {
        var sinceDate = tracker.LastSyncUtc.ToString("yyyy-MM-dd");
        _logger.LogInformation("[NasaSync] Incremental sync since {Date}", sinceDate);

        var query = BuildSelectQuery()
            .Where(NasaColumns.UpdateDate, ">", sinceDate)
            .Build();

        var dtos = await _nasaClient.FetchPlanetAcync(query, ct);

        if (dtos.Count == 0)
        {
            _logger.LogInformation("[NasaSync] No updated records found.");
            // Still mark success to update the timestamp
            using var session = _store.OpenAsyncSession();
            var t = await session.LoadAsync<SyncTracker>($"SyncTrackers/{ProviderId}", ct);
            t?.MarkSuccess(0);
            await session.SaveChangesAsync(ct);
            return;
        }

        var upserted = await UpsertPlanetsAsync(dtos, ct);
        _logger.LogInformation("[NasaSync] Incremental sync: upserted {Count} planets.", upserted);

        using var updateSession = _store.OpenAsyncSession();
        var updatedTracker = await updateSession.LoadAsync<SyncTracker>($"SyncTrackers/{ProviderId}", ct);
        if (updatedTracker != null)
        {
            updatedTracker.MarkSuccess(upserted);
            await updateSession.SaveChangesAsync(ct);
        }
    }

    /// <summary>
    /// Upserts a batch of ExoplanetDto records into RavenDB.
    /// Uses StoreAsync which acts as an upsert when the document ID matches.
    /// </summary>
    private async Task<int> UpsertPlanetsAsync(List<ExoplanetDto> dtos, CancellationToken ct)
    {
        int count = 0;

        // RavenDB sessions have a default max of 30 requests per session,
        // so we batch in chunks of 25.
        const int batchSize = 25;

        for (int i = 0; i < dtos.Count; i += batchSize)
        {
            using var session = _store.OpenAsyncSession();
            var batch = dtos.Skip(i).Take(batchSize);

            foreach (var dto in batch)
            {
                if (string.IsNullOrWhiteSpace(dto.Name))
                    continue;

                var planet = Exoplanet.Create(
                    name: dto.Name,
                    discoveryMethod: dto.DiscoveryMethod,
                    massEarth: dto.MassEarth,
                    lowerBoundMassEarth: dto.LowerBoundMassEarth,
                    radiusEarth: dto.RadiusEarth,
                    radiusJupiter: dto.RadiusJupiter,
                    orbitalPeriodDays: dto.OrbitalPeriodDays,
                    eccentricity: dto.Eccentricity,
                    semiMajorAxisAu: dto.SemiMajorAxisAu,
                    stellarEffectiveTemperatureK: dto.StellarEffectiveTemperatureK,
                    distanceParsecs: dto.DistanceParsecs
                );

                await session.StoreAsync(planet, planet.Id, ct);
                count++;
            }

            await session.SaveChangesAsync(ct);
        }

        return count;
    }

    private static AdqlQueryBuilder BuildSelectQuery()
    {
        return new AdqlQueryBuilder()
            .Select(
                NasaColumns.PlanetName,
                NasaColumns.DiscoveryMethod,
                NasaColumns.MassEarth,
                NasaColumns.LowerBoundMassEarth,
                NasaColumns.RadiusEarth,
                NasaColumns.RadiusJupiter,
                NasaColumns.OrbitalPeriod,
                NasaColumns.OrbitalEccentricity,
                NasaColumns.SemiMajorAxis,
                NasaColumns.StellarEffTemp,
                NasaColumns.Distance,
                NasaColumns.UpdateDate
            )
            .From(NasaTables.ConfirmedPlanets);
    }
}
