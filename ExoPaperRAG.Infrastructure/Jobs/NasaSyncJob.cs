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

            if (tracker == null || tracker.LastSyncUtc <= DateTime.MinValue)
            {
                if (tracker == null)
                {
                    tracker = SyncTracker.CreateForProvider(ProviderId);
                    await session.StoreAsync(tracker, ct);
                    await session.SaveChangesAsync(ct);
                }

                await SeedFullCatalogAsync(tracker, ct);
            }
            else
            {
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

        var query = BuildSelectQuery().Build();

        _logger.LogInformation("[NasaSync] Fetching all records without pagination.");

        var dtos = await _nasaClient.FetchPlanetAcync(query, ct);

        if (dtos.Count == 0)
        {
            _logger.LogInformation("[NasaSync] No records. Seeding complete.");
            return;
        }

        var upserted = await UpsertPlanetsAsync(dtos, ct);

        _logger.LogInformation("[NasaSync] Upserted {Count} planets.", upserted);

        // Update tracker
        using var session = _store.OpenAsyncSession();
        var freshTracker = await session.LoadAsync<SyncTracker>($"SyncTrackers/{ProviderId}", ct);
        if (freshTracker != null)
        {
            freshTracker.MarkSuccess(upserted);
            await session.SaveChangesAsync(ct);
        }
    }

    /// <summary>
    /// Fetches only planets that have been updated since the last sync.
    /// </summary>
    private async Task IncrementalSyncAsync(SyncTracker tracker, CancellationToken ct)
    {
        _logger.LogInformation("[NasaSync] Incremental sync not supported for pscomppars. Running full sync.");
        await SeedFullCatalogAsync(tracker, ct);
    }

    /// <summary>
    /// Upserts a batch of ExoplanetDto records into RavenDB.
    /// Existing planets are loaded and only their scientific fields are updated,
    /// so enrichment state (Tags, embeddings) survives every sync. New planets are created.
    /// </summary>
    private async Task<int> UpsertPlanetsAsync(List<ExoplanetDto> dtos, CancellationToken ct)
    {
        int count = 0;
        const int batchSize = 25;

        for (int i = 0; i < dtos.Count; i += batchSize)
        {
            using var session = _store.OpenAsyncSession();
            var batch = dtos.Skip(i).Take(batchSize).ToList();

            // Bulk-load existing documents in a single round-trip.
            var ids = batch
                .Where(d => !string.IsNullOrWhiteSpace(d.Name))
                .Select(d => Exoplanet.BuildId(d.Name))
                .Distinct()
                .ToArray();

            var existing = ids.Length > 0
                ? await session.LoadAsync<Exoplanet>(ids, ct)
                : new Dictionary<string, Exoplanet>();

            foreach (var dto in batch)
            {
                if (string.IsNullOrWhiteSpace(dto.Name))
                    continue;

                var id = Exoplanet.BuildId(dto.Name);

                if (existing.TryGetValue(id, out var planet) && planet != null)
                {
                    // Update in place — preserves Tags / HasEmbeddings / TagsProcessed
                    // unless a scientific field changed (then re-tagging is triggered).
                    planet.ApplyScientificUpdate(
                        dto.DiscoveryMethod,
                        dto.MassEarth,
                        dto.LowerBoundMassEarth,
                        dto.RadiusEarth,
                        dto.RadiusJupiter,
                        dto.OrbitalPeriodDays,
                        dto.Eccentricity,
                        dto.SemiMajorAxisAu,
                        dto.StellarEffectiveTemperatureK,
                        dto.DistanceParsecs);
                }
                else
                {
                    var created = Exoplanet.Create(
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
                        distanceParsecs: dto.DistanceParsecs);

                    await session.StoreAsync(created, created.Id, ct);
                }

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
                NasaColumns.Distance
            )
            .From(NasaTables.ConfirmedPlanets);
    }
}
