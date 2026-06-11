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
    /// Fetches and reconciles all planets from NASA since the composite parameters table
    /// lacks individual row update timestamp columns.
    /// </summary>
    private async Task IncrementalSyncAsync(SyncTracker tracker, CancellationToken ct)
    {
        _logger.LogInformation("[NasaSync] Incremental sync requested. Since the composite parameters table (pscomppars) lacks row update timestamps, running full catalog reconciliation...");

        var query = BuildSelectQuery().Build();

        var dtos = await _nasaClient.FetchPlanetAcync(query, ct);

        if (dtos.Count == 0)
        {
            _logger.LogInformation("[NasaSync] No records found. Sync complete.");
            return;
        }

        var upserted = await UpsertPlanetsAsync(dtos, ct);
        _logger.LogInformation("[NasaSync] Incremental sync completed. Reconciled {Count} planets.", upserted);

        using var session = _store.OpenAsyncSession();
        var freshTracker = await session.LoadAsync<SyncTracker>($"SyncTrackers/{ProviderId}", ct);
        if (freshTracker != null)
        {
            freshTracker.MarkSuccess(upserted);
            await session.SaveChangesAsync(ct);
        }
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

                var data = MapToScientificData(dto);

                if (existing.TryGetValue(id, out var planet) && planet != null)
                {
                    // Update in place — preserves Tags / HasEmbeddings / TagsProcessed
                    // unless a scientific field changed (then re-tagging is triggered).
                    planet.ApplyScientificUpdate(data);
                }
                else
                {
                    var created = Exoplanet.Create(dto.Name, data);
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
                // Identity / system
                NasaColumns.PlanetName, NasaColumns.HostName, NasaColumns.PlanetLetter,
                NasaColumns.NumberOfStars, NasaColumns.NumberOfPlanets,
                NasaColumns.RightAscension, NasaColumns.Declination,
                NasaColumns.VMagnitude, NasaColumns.KMagnitude, NasaColumns.GaiaMagnitude,
                // Aliases
                NasaColumns.HdName, NasaColumns.HipName, NasaColumns.TicId,
                // Discovery
                NasaColumns.DiscoveryMethod, NasaColumns.DiscoveryYear, NasaColumns.DiscoveryFacility,
                NasaColumns.DiscoveryTelescope, NasaColumns.DiscoveryInstrument,
                // Orbit
                NasaColumns.OrbitalPeriod, NasaColumns.OrbitalEccentricity,
                NasaColumns.SemiMajorAxis, NasaColumns.Inclination,
                // Mass / radius / density
                NasaColumns.MassEarth, NasaColumns.LowerBoundMassEarth, NasaColumns.MassJupiter,
                NasaColumns.MassProvenance, NasaColumns.MsiniEarth,
                NasaColumns.RadiusEarth, NasaColumns.RadiusJupiter, NasaColumns.Density,
                // Climate
                NasaColumns.EquilibriumTemperature, NasaColumns.InsolationFlux,
                // Host star
                NasaColumns.SpectralType, NasaColumns.StellarEffTemp, NasaColumns.StellarRadius,
                NasaColumns.StellarMass, NasaColumns.StellarLuminosity, NasaColumns.StellarSurfaceGravity,
                NasaColumns.StellarMetallicity, NasaColumns.StellarAge,
                // System
                NasaColumns.Distance,
                // Quality (soltype / pl_refname come from the `ps` table in Phase 2)
                NasaColumns.ControversialFlag
            )
            .From(NasaTables.ConfirmedPlanets);
    }

    /// <summary>Maps a raw NASA row to the domain's scientific-data transport record.</summary>
    private static ExoplanetScientificData MapToScientificData(ExoplanetDto dto)
    {
        var aliases = new List<string>();
        void AddAlias(string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
                aliases.Add(value!.Trim());
        }
        AddAlias(dto.HostName);
        AddAlias(dto.HdName);
        AddAlias(dto.HipName);
        AddAlias(dto.TicId);

        return new ExoplanetScientificData
        {
            HostName = dto.HostName,
            PlanetLetter = dto.PlanetLetter,
            Aliases = aliases.Distinct().ToList(),
            NumberOfStars = dto.NumberOfStars.HasValue ? (int)dto.NumberOfStars.Value : null,
            NumberOfPlanets = dto.NumberOfPlanets.HasValue ? (int)dto.NumberOfPlanets.Value : null,
            RightAscension = dto.RightAscension,
            Declination = dto.Declination,
            VMagnitude = dto.VMagnitude,
            KMagnitude = dto.KMagnitude,
            GaiaMagnitude = dto.GaiaMagnitude,

            DiscoveryMethod = dto.DiscoveryMethod,
            DiscoveryYear = dto.DiscoveryYear.HasValue ? (int)dto.DiscoveryYear.Value : null,
            DiscoveryFacility = dto.DiscoveryFacility,
            DiscoveryTelescope = dto.DiscoveryTelescope,
            DiscoveryInstrument = dto.DiscoveryInstrument,

            OrbitalPeriodDays = dto.OrbitalPeriodDays,
            SemiMajorAxisAu = dto.SemiMajorAxisAu,
            Eccentricity = dto.Eccentricity,
            InclinationDeg = dto.InclinationDeg,

            MassEarth = dto.MassEarth,
            MassEarthBest = dto.MassEarthBest,
            MassJupiter = dto.MassJupiter,
            MassProvenance = dto.MassProvenance,
            MsiniEarth = dto.MsiniEarth,
            RadiusEarth = dto.RadiusEarth,
            RadiusJupiter = dto.RadiusJupiter,
            DensityGramPerCm3 = dto.DensityGramPerCm3,

            EquilibriumTemperatureK = dto.EquilibriumTemperatureK,
            InsolationFlux = dto.InsolationFlux,

            SpectralType = dto.SpectralType,
            StellarEffectiveTemperatureK = dto.StellarEffectiveTemperatureK,
            StellarRadiusSolar = dto.StellarRadiusSolar,
            StellarMassSolar = dto.StellarMassSolar,
            StellarLuminosityLogSolar = dto.StellarLuminosityLogSolar,
            StellarSurfaceGravity = dto.StellarSurfaceGravity,
            StellarMetallicity = dto.StellarMetallicity,
            StellarAgeGyr = dto.StellarAgeGyr,

            DistanceParsecs = dto.DistanceParsecs,

            SolutionType = dto.SolutionType,
            IsControversial = dto.ControversialFlag.HasValue ? dto.ControversialFlag.Value > 0.5 : null,
            ReferenceName = dto.ReferenceName
        };
    }
}
