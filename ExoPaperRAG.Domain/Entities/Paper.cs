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
    /// Number of embedding chunks stored for this paper. Chunks themselves live in separate
    /// <see cref="PaperChunk"/> documents ("PaperChunks/{arxivId}/{index}") so the Paper document
    /// stays small — storing hundreds of 768-dim vectors inline made documents exceed RavenDB's
    /// 5 MB threshold and caused slow writes.
    /// </summary>
    public int ChunkCount { get; set; }

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
            ChunkCount = 0,
            IsReviewed = false
        };
    }

    /// <summary>Records how many chunk documents were stored and marks the paper embedded.</summary>
    public void SetEmbedded(int chunkCount)
    {
        ChunkCount = chunkCount;
        HasEmbeddings = chunkCount > 0;
    }

    /// <summary>Deterministic chunk-document id for a given paper + chunk index.</summary>
    public static string ChunkId(string paperId, int index)
    {
        var arxivId = paperId.Replace("papers/", string.Empty);
        return $"PaperChunks/{arxivId}/{index}";
    }
}

/// <summary>
/// A single embedded text chunk of a paper, stored as its own document so the parent Paper
/// document stays small. Indexed for Corax vector search by <c>Papers_ByVector</c>.
/// </summary>
public class PaperChunk
{
    public string Id { get; set; } = string.Empty;       // PaperChunks/{arxivId}/{index}
    public string PaperId { get; set; } = string.Empty;  // papers/{arxivId}
    public int Index { get; set; }
    public string Text { get; set; } = string.Empty;
    public float[] Vector { get; set; } = Array.Empty<float>();
}
