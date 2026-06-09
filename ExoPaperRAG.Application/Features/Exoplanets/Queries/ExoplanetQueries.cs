using ExoPaperRAG.Application.Common;
using ExoPaperRAG.Application.Contracts;
using ExoPaperRAG.Application.Indexes;
using ExoPaperRAG.Domain.Entities;
using MediatR;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;

namespace ExoPaperRAG.Application.Features.Exoplanets.Queries;

// ── List with optional filter / paging / sorting ──────────────────────────
public record GetExoplanetsQuery(
    string? DiscoveryMethod = null,
    int Skip = 0,
    int Take = 10,
    string? SortBy = null) : IRequest<IReadOnlyList<ExoplanetResponse>>;

public class GetExoplanetsQueryHandler
    : IRequestHandler<GetExoplanetsQuery, IReadOnlyList<ExoplanetResponse>>
{
    private readonly IDocumentStore _store;
    public GetExoplanetsQueryHandler(IDocumentStore store) => _store = store;

    public async Task<IReadOnlyList<ExoplanetResponse>> Handle(GetExoplanetsQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var query = session.Query<Exoplanet>();

        if (!string.IsNullOrEmpty(request.DiscoveryMethod))
            query = query.Where(p => p.DiscoveryMethod == request.DiscoveryMethod);

        if (request.SortBy == "orbitalPeriod")
            query = query.OrderBy(p => p.OrbitalPeriodDays);

        var results = await query
            .Skip(request.Skip)
            .Take(Math.Clamp(request.Take, 1, 100))
            .ToListAsync(ct);

        return results.Select(p => p.ToResponse()).ToList();
    }
}

// ── Single by id ───────────────────────────────────────────────────────────
public record GetExoplanetByIdQuery(string Id) : IRequest<ExoplanetResponse?>;

public class GetExoplanetByIdQueryHandler : IRequestHandler<GetExoplanetByIdQuery, ExoplanetResponse?>
{
    private readonly IDocumentStore _store;
    public GetExoplanetByIdQueryHandler(IDocumentStore store) => _store = store;

    public async Task<ExoplanetResponse?> Handle(GetExoplanetByIdQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var docId = RavenIds.EnsurePrefix(request.Id, "exoplanets/");
        var planet = await session.LoadAsync<Exoplanet>(docId, ct);
        return planet?.ToResponse();
    }
}

// ── Potentially-habitable (static index) ────────────────────────────────────
public record GetHabitableExoplanetsQuery(int Skip = 0, int Take = 10)
    : IRequest<IReadOnlyList<ExoplanetResponse>>;

public class GetHabitableExoplanetsQueryHandler
    : IRequestHandler<GetHabitableExoplanetsQuery, IReadOnlyList<ExoplanetResponse>>
{
    private readonly IDocumentStore _store;
    public GetHabitableExoplanetsQueryHandler(IDocumentStore store) => _store = store;

    public async Task<IReadOnlyList<ExoplanetResponse>> Handle(GetHabitableExoplanetsQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var results = await session
            .Query<Exoplanets_ByHabitability.Result, Exoplanets_ByHabitability>()
            .Where(x => x.IsPotentiallyHabitable)
            .OfType<Exoplanet>()
            .Skip(request.Skip)
            .Take(Math.Clamp(request.Take, 1, 1000))
            .ToListAsync(ct);

        return results.Select(p => p.ToResponse()).ToList();
    }
}

// ── Discovery-method statistics (map-reduce index) ──────────────────────────
public record GetDiscoveryStatsQuery : IRequest<IReadOnlyList<DiscoveryStatResponse>>;

public class GetDiscoveryStatsQueryHandler
    : IRequestHandler<GetDiscoveryStatsQuery, IReadOnlyList<DiscoveryStatResponse>>
{
    private readonly IDocumentStore _store;
    public GetDiscoveryStatsQueryHandler(IDocumentStore store) => _store = store;

    public async Task<IReadOnlyList<DiscoveryStatResponse>> Handle(GetDiscoveryStatsQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var results = await session
            .Query<Exoplanets_StatsByDiscoveryMethod.Result, Exoplanets_StatsByDiscoveryMethod>()
            .ToListAsync(ct);

        return results.Select(r => new DiscoveryStatResponse
        {
            DiscoveryMethod = r.DiscoveryMethod,
            Count = r.Count,
            TotalMass = r.TotalMass,
            AverageMass = r.AverageMass
        }).ToList();
    }
}
