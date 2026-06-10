using ExoPaperRAG.Domain.Entities;
using MediatR;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;

namespace ExoPaperRAG.Application.Features.Sync.Queries;

/// <summary>Pipeline coverage metrics: how much of the corpus is ingested / vectorized / linked.</summary>
public record GetSystemHealthQuery : IRequest<SystemHealthResponse>;

public record SystemHealthResponse
{
    public int TotalPlanets { get; init; }
    public int TotalPapers { get; init; }
    public int PapersEmbedded { get; init; }
    public int PapersLinked { get; init; }
    public int EmbeddingCoveragePercent { get; init; }
    public int LinkingCoveragePercent { get; init; }
}

public class GetSystemHealthQueryHandler : IRequestHandler<GetSystemHealthQuery, SystemHealthResponse>
{
    private readonly IDocumentStore _store;
    public GetSystemHealthQueryHandler(IDocumentStore store) => _store = store;

    public async Task<SystemHealthResponse> Handle(GetSystemHealthQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();

        var totalPlanets = await session.Query<Exoplanet>().CountAsync(ct);
        var totalPapers = await session.Query<Paper>().CountAsync(ct);
        var papersEmbedded = await session.Query<Paper>().Where(p => p.HasEmbeddings).CountAsync(ct);
        var papersLinked = await session.Query<Paper>().Where(p => p.LinksProcessed).CountAsync(ct);

        return new SystemHealthResponse
        {
            TotalPlanets = totalPlanets,
            TotalPapers = totalPapers,
            PapersEmbedded = papersEmbedded,
            PapersLinked = papersLinked,
            EmbeddingCoveragePercent = Percent(papersEmbedded, totalPapers),
            LinkingCoveragePercent = Percent(papersLinked, totalPapers)
        };
    }

    private static int Percent(int part, int total) =>
        total == 0 ? 0 : (int)System.Math.Round(part * 100.0 / total);
}
