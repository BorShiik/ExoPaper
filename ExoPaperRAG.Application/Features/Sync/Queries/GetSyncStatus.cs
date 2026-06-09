using ExoPaperRAG.Application.Contracts;
using ExoPaperRAG.Domain.Entities;
using MediatR;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;

namespace ExoPaperRAG.Application.Features.Sync.Queries;

/// <summary>Returns the current sync status for every data provider (NASA, arXiv, ...).</summary>
public record GetSyncStatusQuery : IRequest<IReadOnlyList<SyncStatusResponse>>;

public class GetSyncStatusQueryHandler : IRequestHandler<GetSyncStatusQuery, IReadOnlyList<SyncStatusResponse>>
{
    private readonly IDocumentStore _store;
    public GetSyncStatusQueryHandler(IDocumentStore store) => _store = store;

    public async Task<IReadOnlyList<SyncStatusResponse>> Handle(GetSyncStatusQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var trackers = await session.Query<SyncTracker>().ToListAsync(ct);

        return trackers
            .OrderBy(t => t.ProviderName)
            .Select(t => new SyncStatusResponse
            {
                ProviderName = t.ProviderName,
                LastSyncUtc = t.LastSyncUtc,
                TotalDocumentsSynced = t.TotalDocumentsSynced,
                LastError = t.LastError
            })
            .ToList();
    }
}
