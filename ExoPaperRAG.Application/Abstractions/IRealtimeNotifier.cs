namespace ExoPaperRAG.Application.Abstractions;

public interface IRealtimeNotifier
{
    Task BroadcastEventAsync(string eventType, string payloadJson, CancellationToken cancellationToken = default);
    Task SendToPlanetGroupAsync(string planetId, string eventType, string payloadJson, CancellationToken cancellationToken = default);
}
