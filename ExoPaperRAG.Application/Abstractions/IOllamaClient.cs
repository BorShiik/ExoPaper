namespace ExoPaperRAG.Application.Abstractions;

/// <summary>
/// Abstraction for calling the Ollama LLM service.
/// Implementation lives in Infrastructure layer to keep clean architecture.
/// </summary>
public interface IOllamaClient
{
    /// <summary>
    /// Generates an embedding vector for the given text using the configured embedding model.
    /// </summary>
    Task<float[]> GetEmbeddingAsync(string text, CancellationToken ct = default);

    /// <summary>
    /// Generates a text completion using the configured generation model (llama3:8b).
    /// </summary>
    Task<string> GenerateAsync(string prompt, string? systemPrompt = null, CancellationToken ct = default);

    /// <summary>
    /// Streams a text completion token-by-token as it is produced by the model.
    /// </summary>
    IAsyncEnumerable<string> GenerateStreamAsync(
        string prompt, string? systemPrompt = null, CancellationToken ct = default);
}
