using ExoPaperRAG.Application.Common;
using ExoPaperRAG.Application.Contracts;
using ExoPaperRAG.Application.Indexes;
using ExoPaperRAG.Domain.Entities;
using MediatR;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;
using Raven.Client.Documents.Queries;

namespace ExoPaperRAG.Application.Features.Papers.Queries;

// ── Full-text search over abstracts ─────────────────────────────────────────
public record SearchPapersQuery(string? Query = null, int Skip = 0, int Take = 10)
    : IRequest<IReadOnlyList<PaperResponse>>;

public class SearchPapersQueryHandler : IRequestHandler<SearchPapersQuery, IReadOnlyList<PaperResponse>>
{
    private readonly IDocumentStore _store;
    public SearchPapersQueryHandler(IDocumentStore store) => _store = store;

    public async Task<IReadOnlyList<PaperResponse>> Handle(SearchPapersQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var queryable = session.Query<Paper, Papers_ByAbstractSearch>();

        if (!string.IsNullOrWhiteSpace(request.Query))
            queryable = queryable.Search(x => x.Abstract, request.Query);

        var results = await queryable
            .OrderByDescending(x => x.PublishedDate) // newest first
            .Skip(request.Skip)
            .Take(Math.Clamp(request.Take, 1, 100))
            .ToListAsync(ct);

        return results.Select(p => p.ToResponse()).ToList();
    }
}

// ── Papers linked to an exoplanet ───────────────────────────────────────────
public record GetPapersByExoplanetQuery(string ExoplanetId, int Skip = 0, int Take = 10)
    : IRequest<IReadOnlyList<PaperResponse>>;

public class GetPapersByExoplanetQueryHandler
    : IRequestHandler<GetPapersByExoplanetQuery, IReadOnlyList<PaperResponse>>
{
    private readonly IDocumentStore _store;
    public GetPapersByExoplanetQueryHandler(IDocumentStore store) => _store = store;

    public async Task<IReadOnlyList<PaperResponse>> Handle(GetPapersByExoplanetQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var docId = RavenIds.EnsurePrefix(request.ExoplanetId, "exoplanets/");

        // 1. Hard links written by the PaperLinkingWorker (ExoplanetIds contains the doc id).
        var linked = await session.Query<Paper>()
            .Where(x => x.ExoplanetIds.Contains(docId))
            .OrderByDescending(x => x.PublishedDate)
            .Skip(request.Skip)
            .Take(Math.Clamp(request.Take, 1, 100))
            .ToListAsync(ct);

        if (linked.Count > 0)
            return linked.Select(p => p.ToResponse()).ToList();

        // 2. Fallback: no explicit links yet → surface preprints that mention the
        //    host star by name, so the literature panel is still useful.
        var planet = await session.LoadAsync<Exoplanet>(docId, ct);
        var term = BuildHostSearchTerm(planet?.Name);
        if (string.IsNullOrWhiteSpace(term))
            return Array.Empty<PaperResponse>();

        var related = await session.Query<Paper, Papers_ByAbstractSearch>()
            .Search(x => x.Abstract, term)
            .OrderByDescending(x => x.PublishedDate)
            .Take(Math.Clamp(request.Take, 1, 100))
            .ToListAsync(ct);

        return related.Select(p => p.ToResponse()).ToList();
    }

    /// <summary>
    /// Derives a distinctive search term from a planet name by dropping the
    /// trailing planet designation (e.g. "HN Peg b" → "HN Peg",
    /// "MOA-2008-BLG-310L b" → "MOA-2008-BLG-310L"), so the fallback doesn't
    /// match every abstract that merely contains the letter "b".
    /// </summary>
    private static string? BuildHostSearchTerm(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        var trimmed = name.Trim();
        var lastSpace = trimmed.LastIndexOf(' ');
        if (lastSpace > 0 && trimmed.Length - lastSpace <= 3) // " b", " AB", " bc"
            trimmed = trimmed[..lastSpace];
        return trimmed.Trim();
    }
}

// ── Paper with its authors (Include — no N+1) ───────────────────────────────
public record GetPaperWithAuthorsQuery(string Id) : IRequest<PaperWithAuthorsResponse?>;

public class GetPaperWithAuthorsQueryHandler
    : IRequestHandler<GetPaperWithAuthorsQuery, PaperWithAuthorsResponse?>
{
    private readonly IDocumentStore _store;
    public GetPaperWithAuthorsQueryHandler(IDocumentStore store) => _store = store;

    public async Task<PaperWithAuthorsResponse?> Handle(GetPaperWithAuthorsQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var docId = RavenIds.EnsurePrefix(request.Id, "papers/");

        var paper = await session.LoadAsync<Paper>(
            docId,
            includes => includes.IncludeDocuments(x => x.AuthorIds),
            ct);

        if (paper is null)
            return null;

        // Authors are already in the session (included) — no extra round-trips.
        var loaded = await session.LoadAsync<Author>(paper.AuthorIds, ct);
        var authors = loaded.Values
            .Where(a => a is not null)
            .Select(a => a!.ToResponse())
            .ToList();

        return new PaperWithAuthorsResponse
        {
            Paper = paper.ToResponse(),
            Authors = authors
        };
    }
}

// ── Pure vector similarity over a supplied embedding ────────────────────────
public record FindSimilarPapersQuery(float[] QueryVector, int Take = 5)
    : IRequest<IReadOnlyList<PaperResponse>>;

public class FindSimilarPapersQueryHandler
    : IRequestHandler<FindSimilarPapersQuery, IReadOnlyList<PaperResponse>>
{
    private readonly IDocumentStore _store;
    public FindSimilarPapersQueryHandler(IDocumentStore store) => _store = store;

    public async Task<IReadOnlyList<PaperResponse>> Handle(FindSimilarPapersQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();

        var results = await session.Query<Paper, Papers_ByVector>()
            .VectorSearch(
                indexField => indexField.WithField(x => x.Vector),
                factory => factory.ByEmbedding(request.QueryVector))
            .Take(Math.Clamp(request.Take, 1, 50))
            .ToListAsync(ct);

        return results.Select(p => p.ToResponse()).ToList();
    }
}
