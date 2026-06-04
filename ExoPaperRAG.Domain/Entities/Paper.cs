namespace ExoPaperRAG.Domain.Entities;

public class Paper
{
    public string Id { get; set; } // RavenDB ID (e.g., "papers/12345-v1")
    public string Title { get; set; }
    public string Abstract { get; set; }
    public DateTime PublishedDate { get; set; }
    
    // Relational Documents Requirement (Include)
    public List<string> AuthorIds { get; set; } = new();

    public List<string> ExoplanetIds { get; set; } = new();

    // RAG Metadata
    public bool HasEmbeddings { get; set; }
    
    // Vector Search Requirement
    public float[] Vector { get; set; }

    public bool IsReviewed { get; set; }
}
