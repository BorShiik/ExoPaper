using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Infrastructure.Settings;

namespace ExoPaperRAG.Infrastructure.Services;

public class OllamaClient : IOllamaClient
{
    private readonly HttpClient _http;
    private readonly OllamaSettings _settings;
    private readonly ILogger<OllamaClient> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public OllamaClient(HttpClient http, IOptions<OllamaSettings> settings, ILogger<OllamaClient> logger)
    {
        _http = http;
        _settings = settings.Value;
        _logger = logger;

        _http.BaseAddress = new Uri(_settings.BaseUrl);
        _http.Timeout = TimeSpan.FromMinutes(_settings.GenerationTimeoutMinutes); // LLM generation can be slow
    }

    private string KeepAlive => $"{_settings.KeepAliveMinutes}m";

    private Dictionary<string, object> GenerationOptions
    {
        get
        {
            var opts = new Dictionary<string, object>
            {
                // Context window large enough to hold the prompt (params + literature + schema)
                // AND the generated profile. Ollama's small default (2048) silently truncates the
                // prompt from the START, dropping the system instruction — which made the model
                // ramble about the papers instead of returning the JSON profile.
                ["num_ctx"] = _settings.ContextWindowTokens,
            };
            if (_settings.MaxGenerationTokens > 0)
                opts["num_predict"] = _settings.MaxGenerationTokens;
            return opts;
        }
    }

    /// <inheritdoc />
    public async Task<float[]> GetEmbeddingAsync(string text, CancellationToken ct = default)
    {
        var request = new EmbeddingRequest
        {
            Model = _settings.EmbeddingModel,
            Prompt = text
        };

        _logger.LogDebug("Requesting embedding from Ollama ({Model}), text length: {Len}",
            _settings.EmbeddingModel, text.Length);

        var response = await _http.PostAsJsonAsync("/api/embeddings", request, JsonOptions, ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<EmbeddingResponse>(JsonOptions, ct);

        if (result?.Embedding == null || result.Embedding.Length == 0)
            throw new InvalidOperationException("Ollama returned an empty embedding vector.");

        _logger.LogDebug("Received embedding vector of dimension {Dim}", result.Embedding.Length);
        return result.Embedding;
    }

    /// <inheritdoc />
    public async Task<string> GenerateAsync(string prompt, string? systemPrompt = null, CancellationToken ct = default)
    {
        var request = new GenerateRequest
        {
            Model = _settings.GenerationModel,
            Prompt = prompt,
            System = systemPrompt,
            Stream = false, // get full response at once
            KeepAlive = KeepAlive,
            Options = GenerationOptions
        };

        _logger.LogDebug("Requesting generation from Ollama ({Model}), prompt length: {Len}",
            _settings.GenerationModel, prompt.Length);

        var response = await _http.PostAsJsonAsync("/api/generate", request, JsonOptions, ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<GenerateResponse>(JsonOptions, ct);

        if (string.IsNullOrWhiteSpace(result?.Response))
            throw new InvalidOperationException("Ollama returned an empty generation response.");

        LogTiming(result);
        return result.Response;
    }

    /// <inheritdoc />
    public async Task WarmUpAsync(CancellationToken ct = default)
    {
        // Empty prompt with keep_alive loads the model into memory without generating text,
        // so the first real synthesis doesn't pay the weight-load cost.
        var request = new GenerateRequest
        {
            Model = _settings.GenerationModel,
            Prompt = string.Empty,
            Stream = false,
            KeepAlive = KeepAlive
        };

        var response = await _http.PostAsJsonAsync("/api/generate", request, JsonOptions, ct);
        response.EnsureSuccessStatusCode();
        _logger.LogInformation("Ollama generation model '{Model}' warmed up.", _settings.GenerationModel);
    }

    /// <summary>Logs token throughput so a CPU-bound (vs GPU) deployment is visible in the logs.</summary>
    private void LogTiming(GenerateResponse? result)
    {
        if (result is null) return;
        if (_logger.IsEnabled(LogLevel.Information) && result.EvalCount > 0 && result.EvalDuration > 0)
        {
            var tokensPerSecond = result.EvalCount / (result.EvalDuration / 1_000_000_000.0);
            _logger.LogInformation(
                "Ollama generation: {Tokens} tokens at {Rate:F1} tok/s.",
                result.EvalCount, tokensPerSecond);
        }
    }

    /// <inheritdoc />
    public async IAsyncEnumerable<string> GenerateStreamAsync(
        string prompt, string? systemPrompt = null, [EnumeratorCancellation] CancellationToken ct = default)
    {
        var request = new GenerateRequest
        {
            Model = _settings.GenerationModel,
            Prompt = prompt,
            System = systemPrompt,
            Stream = true,
            KeepAlive = KeepAlive,
            Options = GenerationOptions
        };

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/api/generate")
        {
            Content = JsonContent.Create(request, options: JsonOptions)
        };

        using var response = await _http.SendAsync(
            httpRequest, HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(stream);

        while (!reader.EndOfStream)
        {
            ct.ThrowIfCancellationRequested();

            var line = await reader.ReadLineAsync(ct);
            if (string.IsNullOrWhiteSpace(line))
                continue;

            GenerateResponse? chunk = null;
            try
            {
                chunk = JsonSerializer.Deserialize<GenerateResponse>(line, JsonOptions);
            }
            catch (JsonException)
            {
                // Ignore malformed/partial NDJSON lines.
            }

            if (chunk is null)
                continue;

            if (!string.IsNullOrEmpty(chunk.Response))
                yield return chunk.Response;

            if (chunk.Done)
                yield break;
        }
    }

    // ── DTOs for Ollama REST API ──────────────────────────────────────

    private sealed class EmbeddingRequest
    {
        public string Model { get; set; } = default!;
        public string Prompt { get; set; } = default!;
    }

    private sealed class EmbeddingResponse
    {
        public float[] Embedding { get; set; } = Array.Empty<float>();
    }

    private sealed class GenerateRequest
    {
        public string Model { get; set; } = default!;
        public string Prompt { get; set; } = default!;
        public string? System { get; set; }
        public bool Stream { get; set; }

        [JsonPropertyName("keep_alive")]
        public string? KeepAlive { get; set; }

        public Dictionary<string, object>? Options { get; set; }
    }

    private sealed class GenerateResponse
    {
        public string Response { get; set; } = string.Empty;
        public bool Done { get; set; }

        [JsonPropertyName("eval_count")]
        public int EvalCount { get; set; }

        [JsonPropertyName("eval_duration")]
        public long EvalDuration { get; set; }
    }
}
