namespace ExoPaperRAG.Domain.Entities;

public class Author
{
    public string Id { get; set; } = string.Empty; // e.g. "authors/john-doe"
    public string Name { get; set; } = string.Empty;
    public string Affiliation { get; set; } = string.Empty;
}
