using ExoPaperRAG.Application.Common;
using ExoPaperRAG.Application.Contracts;
using ExoPaperRAG.Domain.Entities;
using MediatR;
using Raven.Client.Documents;

namespace ExoPaperRAG.Application.Features.Authors;

// ── Query: by id ─────────────────────────────────────────────────────────────
public record GetAuthorByIdQuery(string Id) : IRequest<AuthorResponse?>;

public class GetAuthorByIdQueryHandler : IRequestHandler<GetAuthorByIdQuery, AuthorResponse?>
{
    private readonly IDocumentStore _store;
    public GetAuthorByIdQueryHandler(IDocumentStore store) => _store = store;

    public async Task<AuthorResponse?> Handle(GetAuthorByIdQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var author = await session.LoadAsync<Author>(RavenIds.EnsurePrefix(request.Id, "authors/"), ct);
        return author?.ToResponse();
    }
}

// ── Command: create ──────────────────────────────────────────────────────────
public record CreateAuthorCommand(string Name, string Affiliation = "", string? Id = null)
    : IRequest<AuthorResponse>;

public class CreateAuthorCommandHandler : IRequestHandler<CreateAuthorCommand, AuthorResponse>
{
    private readonly IDocumentStore _store;
    public CreateAuthorCommandHandler(IDocumentStore store) => _store = store;

    public async Task<AuthorResponse> Handle(CreateAuthorCommand request, CancellationToken ct)
    {
        var id = string.IsNullOrWhiteSpace(request.Id)
            ? $"authors/{request.Name.Replace(" ", "-").ToLowerInvariant()}"
            : RavenIds.EnsurePrefix(request.Id, "authors/");

        var author = new Author
        {
            Id = id,
            Name = request.Name,
            Affiliation = request.Affiliation
        };

        using var session = _store.OpenAsyncSession();
        await session.StoreAsync(author, author.Id, ct);
        await session.SaveChangesAsync(ct);
        return author.ToResponse();
    }
}

// ── Command: update ──────────────────────────────────────────────────────────
public record UpdateAuthorCommand(string Id, string Name, string Affiliation) : IRequest<bool>;

public class UpdateAuthorCommandHandler : IRequestHandler<UpdateAuthorCommand, bool>
{
    private readonly IDocumentStore _store;
    public UpdateAuthorCommandHandler(IDocumentStore store) => _store = store;

    public async Task<bool> Handle(UpdateAuthorCommand request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var author = await session.LoadAsync<Author>(RavenIds.EnsurePrefix(request.Id, "authors/"), ct);
        if (author is null)
            return false;

        author.Name = request.Name;
        author.Affiliation = request.Affiliation;
        await session.SaveChangesAsync(ct);
        return true;
    }
}

// ── Command: delete ──────────────────────────────────────────────────────────
public record DeleteAuthorCommand(string Id) : IRequest<Unit>;

public class DeleteAuthorCommandHandler : IRequestHandler<DeleteAuthorCommand, Unit>
{
    private readonly IDocumentStore _store;
    public DeleteAuthorCommandHandler(IDocumentStore store) => _store = store;

    public async Task<Unit> Handle(DeleteAuthorCommand request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        session.Delete(RavenIds.EnsurePrefix(request.Id, "authors/"));
        await session.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
