using ExoPaperRAG.Application.Features.Rag;
using MediatR;
using Microsoft.AspNetCore.SignalR;

namespace ExoPaperRAG.Api.Hubs;

public class ExoPaperHub : Hub
{
    private readonly IMediator _mediator;

    public ExoPaperHub(IMediator mediator) => _mediator = mediator;

    public async Task JoinPlanetGroup(string planetId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, planetId);
    }

    public async Task LeavePlanetGroup(string planetId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, planetId);
    }

    /// <summary>
    /// Server-to-client streaming RAG answer. The client subscribes via
    /// connection.stream("StreamAsk", query) and receives "sources", then "token"
    /// chunks, then "done". The CancellationToken is supplied by SignalR and fires
    /// when the client unsubscribes or disconnects.
    /// </summary>
    public IAsyncEnumerable<AskChunk> StreamAsk(AskExoplanetQuery query, CancellationToken cancellationToken)
        => _mediator.CreateStream(query, cancellationToken);
}
