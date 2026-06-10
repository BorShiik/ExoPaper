using System.ComponentModel.DataAnnotations;

namespace ExoPaperRAG.Infrastructure.Settings;

public class OllamaSettings
{
    public const string SectionName = "OllamaSettings";

    /// <summary>Base URL for the Ollama REST API (e.g. http://ollama:11434).</summary>
    [Required(AllowEmptyStrings = false)]
    public string BaseUrl { get; set; } = "http://localhost:11434";

    /// <summary>Model name used for embedding generation (e.g. nomic-embed-text).</summary>
    [Required(AllowEmptyStrings = false)]
    public string EmbeddingModel { get; set; } = "nomic-embed-text";

    /// <summary>Model name used for text generation / analytics (e.g. llama3:8b).</summary>
    [Required(AllowEmptyStrings = false)]
    public string GenerationModel { get; set; } = "llama3:8b";

    /// <summary>
    /// Upper bound on tokens generated per request (Ollama <c>num_predict</c>). Bounds CPU
    /// inference time so a synthesis cannot run past the HTTP timeout. -1 = unlimited.
    /// </summary>
    [Range(-1, 8192)]
    public int MaxGenerationTokens { get; set; } = 2048;

    /// <summary>
    /// How long Ollama keeps the model resident in memory after a request (minutes). Keeps
    /// the generation model warm so users don't pay the weight-load cost on every call.
    /// </summary>
    [Range(0, 1440)]
    public int KeepAliveMinutes { get; set; } = 30;

    /// <summary>Per-request HTTP timeout for generation (minutes). CPU inference can be slow.</summary>
    [Range(1, 30)]
    public int GenerationTimeoutMinutes { get; set; } = 8;

    /// <summary>Load (warm) the generation model on application startup.</summary>
    public bool WarmUpOnStartup { get; set; } = true;
}
