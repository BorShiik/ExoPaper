using ExoPaperRAG.Infrastructure.Settings;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace ExoPaperRAG.Api.HealthChecks;

/// <summary>
/// Probes the Ollama server root endpoint. Reported as Degraded (not Unhealthy)
/// when unreachable, because the API can still serve cached/CRUD data without the LLM.
/// </summary>
public sealed class OllamaHealthCheck : IHealthCheck
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly OllamaSettings _settings;

    public OllamaHealthCheck(IHttpClientFactory httpClientFactory, IOptions<OllamaSettings> settings)
    {
        _httpClientFactory = httpClientFactory;
        _settings = settings.Value;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            using var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(5);

            using var response = await client.GetAsync(_settings.BaseUrl, cancellationToken);

            return response.IsSuccessStatusCode
                ? HealthCheckResult.Healthy("Ollama reachable.")
                : HealthCheckResult.Degraded($"Ollama returned {(int)response.StatusCode}.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Degraded("Ollama unreachable.", ex);
        }
    }
}
