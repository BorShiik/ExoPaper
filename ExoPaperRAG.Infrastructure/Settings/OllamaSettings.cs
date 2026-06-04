namespace ExoPaperRAG.Infrastructure.Settings;

public class OllamaSettings
{
    public const string SectionName = "OllamaSettings";

    /// <summary>Base URL for the Ollama REST API (e.g. http://ollama:11434).</summary>
    public string BaseUrl { get; set; } = "http://localhost:11434";

    /// <summary>Model name used for embedding generation (e.g. nomic-embed-text).</summary>
    public string EmbeddingModel { get; set; } = "nomic-embed-text";

    /// <summary>Model name used for text generation / analytics (e.g. llama3:8b).</summary>
    public string GenerationModel { get; set; } = "llama3:8b";
}
