using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Infrastructure.Settings;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ExoPaperRAG.Infrastructure.Workers;

/// <summary>
/// Loads the Ollama generation model into memory shortly after startup so the first
/// user-triggered synthesis doesn't pay the (potentially large) weight-load cost. Runs in
/// the background — never blocks application startup — and tolerates Ollama not being ready
/// yet by retrying a few times.
/// </summary>
public sealed class OllamaWarmupService : BackgroundService
{
    private readonly IOllamaClient _ollama;
    private readonly OllamaSettings _settings;
    private readonly ILogger<OllamaWarmupService> _logger;

    public OllamaWarmupService(
        IOllamaClient ollama,
        IOptions<OllamaSettings> settings,
        ILogger<OllamaWarmupService> logger)
    {
        _ollama = ollama;
        _settings = settings.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_settings.WarmUpOnStartup)
            return;

        const int maxAttempts = 10;
        var delay = TimeSpan.FromSeconds(6);

        for (var attempt = 1; attempt <= maxAttempts && !stoppingToken.IsCancellationRequested; attempt++)
        {
            try
            {
                await _ollama.WarmUpAsync(stoppingToken);
                return; // success
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex,
                    "Ollama warm-up attempt {Attempt}/{Max} failed (model server may still be pulling/starting).",
                    attempt, maxAttempts);
                try { await Task.Delay(delay, stoppingToken); }
                catch (OperationCanceledException) { return; }
            }
        }

        _logger.LogInformation("Ollama warm-up did not complete; the model will load on first use.");
    }
}
