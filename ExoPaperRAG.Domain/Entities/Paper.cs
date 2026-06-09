using System.Text.Json.Serialization;

namespace ExoPaperRAG.Domain.Entities;

public class Paper
{
    public string Id { get; set; } = string.Empty; // RavenDB ID (e.g., "papers/12345-v1")
    public string Title { get; set; } = string.Empty;
    public string Abstract { get; set; } = string.Empty;
    public DateTime PublishedDate { get; set; }

    // Relational Documents (Include)
    public List<string> AuthorIds { get; set; } = new();
    public List<string> ExoplanetIds { get; set; } = new();

    // RAG Metadata
    public bool HasEmbeddings { get; set; }

    /// <summary>
    /// Semantic embedding of the paper. Persisted in RavenDB (Corax vector index)
    /// but never serialized to API responses — it is large and internal.
    /// RavenDB uses its own (Newtonsoft) serializer, so this STJ attribute only
    /// affects ASP.NET Core responses, not storage.
    /// </summary>
    [JsonIgnore]
    public float[] Vector { get; set; } = Array.Empty<float>();

    public bool IsReviewed { get; set; }

    /// <summary>
    /// Whether the entity-linking pass (matching exoplanet names in the title/abstract
    /// to populate <see cref="ExoplanetIds"/>) has run. Reset on every (re-)harvest.
    /// </summary>
    public bool LinksProcessed { get; set; }

    /// <summary>Replaces the linked exoplanets and marks linking as processed.</summary>
    public void SetExoplanetLinks(IEnumerable<string> exoplanetIds)
    {
        ExoplanetIds = exoplanetIds.Distinct().ToList();
        LinksProcessed = true;
    }

    /// <summary>
    /// Creates (or rebuilds) a Paper from a harvested source record. Embeddings are
    /// intentionally reset so the embedding worker re-vectorizes the new content.
    /// </summary>
    public static Paper Create(
        string id,
        string title,
        string @abstract,
        DateTime publishedDate,
        List<string> authorIds)
    {
        return new Paper
        {
            Id = id,
            Title = title,
            Abstract = @abstract,
            PublishedDate = publishedDate,
            AuthorIds = authorIds,
            ExoplanetIds = new List<string>(),
            HasEmbeddings = false,
            Vector = Array.Empty<float>(),
            IsReviewed = false
        };
    }

    /// <summary>Stores a freshly computed embedding and marks the paper as embedded.</summary>
    public void SetEmbedding(float[] embedding)
    {
        Vector = embedding ?? Array.Empty<float>();
        HasEmbeddings = Vector.Length > 0;
    }
}
