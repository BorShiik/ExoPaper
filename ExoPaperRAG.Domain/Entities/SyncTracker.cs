namespace ExoPaperRAG.Domain.Entities;

/// <summary>
/// Tracks last successful sync time for each data provider.
/// Stored in RavenDB as a single document per provider (e.g., "SyncTrackers/Nasa", "SyncTrackers/Arxiv").
/// </summary>
public class SyncTracker
{
    public string Id { get; set; } = string.Empty;
    public string ProviderName { get; set; } = string.Empty;
    public DateTime LastSyncUtc { get; set; }
    public int TotalDocumentsSynced { get; set; }
    public string? LastError { get; set; }

    public static SyncTracker CreateForProvider(string providerName)
    {
        return new SyncTracker
        {
            Id = $"SyncTrackers/{providerName}",
            ProviderName = providerName,
            LastSyncUtc = DateTime.MinValue,
            TotalDocumentsSynced = 0
        };
    }

    public void MarkSuccess(int documentCount)
    {
        LastSyncUtc = DateTime.UtcNow;
        TotalDocumentsSynced += documentCount;
        LastError = null;
    }

    public void MarkError(string error)
    {
        LastError = error;
    }
}
