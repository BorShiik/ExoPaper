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
    /// Generates a text completion using the configured generation model.
    /// When <paramref name="jsonMode"/> is true, Ollama is constrained to emit syntactically
    /// valid JSON (grammar-enforced) — essential for reliable structured output from small models.
    /// </summary>
    Task<string> GenerateAsync(
        string prompt, string? systemPrompt = null, CancellationToken ct = default, bool jsonMode = false);

    /// <summary>
    /// Streams a text completion token-by-token as it is produced by the model.
    /// </summary>
    IAsyncEnumerable<string> GenerateStreamAsync(
        string prompt, string? systemPrompt = null, CancellationToken ct = default);

    /// <summary>
    /// Loads the generation model into memory ahead of time so the first real request
    /// doesn't pay the model-load cost. Safe to call repeatedly.
    /// </summary>
    Task WarmUpAsync(CancellationToken ct = default);
}
