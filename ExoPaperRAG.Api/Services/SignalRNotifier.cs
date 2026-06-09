using ExoPaperRAG.Api.Hubs;
using ExoPaperRAG.Application.Abstractions;
using Microsoft.AspNetCore.SignalR;

namespace ExoPaperRAG.Api.Services;

public class SignalRNotifier : IRealtimeNotifier
{
    private readonly IHubContext<ExoPaperHub> _hubContext;

    public SignalRNotifier(IHubContext<ExoPaperHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task BroadcastEventAsync(string eventType, string payloadJson, CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients.All.SendAsync("ReceiveEvent", eventType, payloadJson, cancellationToken);
    }

    public async Task SendToPlanetGroupAsync(string planetId, string eventType, string payloadJson, CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients.Group(planetId).SendAsync("ReceivePlanetEvent", eventType, payloadJson, cancellationToken);
    }
}
