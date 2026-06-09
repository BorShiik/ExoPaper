using ExoPaperRAG.Application.Contracts;
using ExoPaperRAG.Domain.Entities;
using MediatR;
using Raven.Client.Documents;
using Raven.Client.Documents.Operations;
using Raven.Client.Documents.Queries;

namespace ExoPaperRAG.Application.Features.Papers.Commands;

// ── Create ─────────────────────────────────────────────────────────────────
public record CreatePaperCommand(
    string Title,
    string Abstract,
    DateTime PublishedDate,
    List<string>? AuthorIds = null,
    string? Id = null) : IRequest<PaperResponse>;

public class CreatePaperCommandHandler : IRequestHandler<CreatePaperCommand, PaperResponse>
{
    private readonly IDocumentStore _store;
    public CreatePaperCommandHandler(IDocumentStore store) => _store = store;

    public async Task<PaperResponse> Handle(CreatePaperCommand request, CancellationToken ct)
    {
        var id = string.IsNullOrWhiteSpace(request.Id) ? $"papers/{Guid.NewGuid():N}" : request.Id;
        var paper = Paper.Create(id, request.Title, request.Abstract, request.PublishedDate,
            request.AuthorIds ?? new List<string>());

        using var session = _store.OpenAsyncSession();
        await session.StoreAsync(paper, paper.Id, ct);
        await session.SaveChangesAsync(ct);
        return paper.ToResponse();
    }
}

// ── Bulk PatchByQuery: mark every paper as reviewed ─────────────────────────
public record MarkAllPapersReviewedCommand : IRequest<Unit>;

public class MarkAllPapersReviewedCommandHandler : IRequestHandler<MarkAllPapersReviewedCommand, Unit>
{
    private readonly IDocumentStore _store;
    public MarkAllPapersReviewedCommandHandler(IDocumentStore store) => _store = store;

    public async Task<Unit> Handle(MarkAllPapersReviewedCommand request, CancellationToken ct)
    {
        var operation = await _store.Operations.SendAsync(
            new PatchByQueryOperation(new IndexQuery
            {
                Query = "from Papers update { this.IsReviewed = true; }"
            }), token: ct);

        await operation.WaitForCompletionAsync(TimeSpan.FromSeconds(30));
        return Unit.Value;
    }
}
