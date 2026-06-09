namespace ExoPaperRAG.Domain.Entities;

public class OutboxEvent
{
    public string Id { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool Dispatched { get; set; } = false;
}
