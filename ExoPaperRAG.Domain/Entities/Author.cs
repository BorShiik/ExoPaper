namespace ExoPaperRAG.Domain.Entities;

public class Author
{
    public string Id { get; set; } // e.g. "authors/john-doe"
    public string Name { get; set; }
    public string Affiliation { get; set; }
}
