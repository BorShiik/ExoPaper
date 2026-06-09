using ExoPaperRAG.Application.Common;
using ExoPaperRAG.Application.Contracts;
using ExoPaperRAG.Domain.Entities;
using MediatR;
using Raven.Client.Documents;

namespace ExoPaperRAG.Application.Features.Exoplanets.Commands;

// ── Create ─────────────────────────────────────────────────────────────────
public record CreateExoplanetCommand(
    string Name,
    string? DiscoveryMethod = null,
    double? MassEarth = null,
    double? LowerBoundMassEarth = null,
    double? RadiusEarth = null,
    double? RadiusJupiter = null,
    double? OrbitalPeriodDays = null,
    double? Eccentricity = null,
    double? SemiMajorAxisAu = null,
    double? StellarEffectiveTemperatureK = null,
    double? DistanceParsecs = null) : IRequest<ExoplanetResponse>;

public class CreateExoplanetCommandHandler : IRequestHandler<CreateExoplanetCommand, ExoplanetResponse>
{
    private readonly IDocumentStore _store;
    public CreateExoplanetCommandHandler(IDocumentStore store) => _store = store;

    public async Task<ExoplanetResponse> Handle(CreateExoplanetCommand request, CancellationToken ct)
    {
        var planet = Exoplanet.Create(
            request.Name, request.DiscoveryMethod, request.MassEarth, request.LowerBoundMassEarth,
            request.RadiusEarth, request.RadiusJupiter, request.OrbitalPeriodDays, request.Eccentricity,
            request.SemiMajorAxisAu, request.StellarEffectiveTemperatureK, request.DistanceParsecs);

        using var session = _store.OpenAsyncSession();
        await session.StoreAsync(planet, planet.Id, ct);
        await session.SaveChangesAsync(ct);
        return planet.ToResponse();
    }
}

// ── Update (descriptive fields) ─────────────────────────────────────────────
public record UpdateExoplanetCommand(
    string Id,
    string Name,
    string? DiscoveryMethod,
    double? MassEarth) : IRequest<bool>;

public class UpdateExoplanetCommandHandler : IRequestHandler<UpdateExoplanetCommand, bool>
{
    private readonly IDocumentStore _store;
    public UpdateExoplanetCommandHandler(IDocumentStore store) => _store = store;

    public async Task<bool> Handle(UpdateExoplanetCommand request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var docId = RavenIds.EnsurePrefix(request.Id, "exoplanets/");
        var planet = await session.LoadAsync<Exoplanet>(docId, ct);
        if (planet is null)
            return false;

        planet.UpdateDescriptive(request.Name, request.DiscoveryMethod, request.MassEarth);
        await session.SaveChangesAsync(ct);
        return true;
    }
}

// ── Delete ───────────────────────────────────────────────────────────────────
public record DeleteExoplanetCommand(string Id) : IRequest<Unit>;

public class DeleteExoplanetCommandHandler : IRequestHandler<DeleteExoplanetCommand, Unit>
{
    private readonly IDocumentStore _store;
    public DeleteExoplanetCommandHandler(IDocumentStore store) => _store = store;

    public async Task<Unit> Handle(DeleteExoplanetCommand request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var docId = RavenIds.EnsurePrefix(request.Id, "exoplanets/");
        session.Delete(docId);
        await session.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
