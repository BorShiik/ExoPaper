using Polly;
using Polly.Extensions.Http;
using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Infrastructure.Services;
using ExoPaperRAG.Infrastructure.Settings;
using ExoPaperRAG.Infrastructure.Workers;
using ExoPaperRAG.Infrastructure.Persistence;
using Raven.Client.Documents;
using Microsoft.Extensions.Options;
using ExoPaperRAG.Infrastructure.Jobs;
using Quartz;
using ExoPaperRAG.Domain.Rules;
using ExoPaperRAG.Api.Hubs;
using ExoPaperRAG.Api.Services;
using ExoPaperRAG.Api.HealthChecks;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

namespace ExoPaperRAG.Api
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddControllers();
            builder.Services.AddOpenApi();

            // RFC 7807 ProblemDetails for all error responses.
            builder.Services.AddProblemDetails();

            // ─── CORS ────────────────────────────────────────────────────
            var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                              ?? new[] { "http://localhost:5173", "http://localhost:3000" };

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("DefaultCors", policy =>
                {
                    policy.WithOrigins(corsOrigins)
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials(); // Required for SignalR WebSockets
                });
            });

            // ─── Strongly-typed, validated configuration ──────────────────
            builder.Services.AddOptions<NasaApiSettings>()
                .Bind(builder.Configuration.GetSection(NasaApiSettings.SectionName))
                .ValidateDataAnnotations().ValidateOnStart();

            builder.Services.AddOptions<ArxivSettings>()
                .Bind(builder.Configuration.GetSection(ArxivSettings.SectionName))
                .ValidateDataAnnotations().ValidateOnStart();

            builder.Services.AddOptions<RavenSettings>()
                .Bind(builder.Configuration.GetSection(RavenSettings.SectionName))
                .ValidateDataAnnotations().ValidateOnStart();

            builder.Services.AddOptions<OllamaSettings>()
                .Bind(builder.Configuration.GetSection(OllamaSettings.SectionName))
                .ValidateDataAnnotations().ValidateOnStart();

            // ─── RavenDB document store (connection only; init runs in a hosted service) ──
            builder.Services.AddSingleton<IDocumentStore>(sp =>
            {
                var settings = sp.GetRequiredService<IOptions<RavenSettings>>().Value;
                var store = new DocumentStore
                {
                    Urls = settings.Urls,
                    Database = settings.DatabaseName
                };
                store.Conventions.DisableTopologyUpdates = true;
                store.Conventions.MaxNumberOfRequestsPerSession = 100;
                return store.Initialize();
            });

            // ─── External HTTP clients (Polly resilience) ─────────────────
            builder.Services.AddHttpClient<INasaClient, NasaClient>()
                .AddPolicyHandler(GetRetryPolicy())
                .AddPolicyHandler(GetCircuitBreakerPolicy());

            builder.Services.AddHttpClient<IArxivClient, ArxivClient>((sp, client) =>
                {
                    var arxiv = sp.GetRequiredService<IOptions<ArxivSettings>>().Value;
                    // OAI-PMH large-range pages can take minutes; the 100s default cancels them.
                    client.Timeout = TimeSpan.FromSeconds(arxiv.HarvestTimeoutSeconds);
                })
                .AddPolicyHandler(GetArxivRetryPolicy());

            builder.Services.AddHttpClient<IOllamaClient, OllamaClient>()
                .AddPolicyHandler(GetRetryPolicy());

            // ─── Real-time (SignalR) ──────────────────────────────────────
            builder.Services.AddSignalR();
            builder.Services.AddSingleton<IRealtimeNotifier, SignalRNotifier>();

            // ─── Tagging rules ────────────────────────────────────────────
            builder.Services.AddSingleton<IExoplanetTaggingRule, HwoCandidateRule>();

            // ─── MediatR (CQRS) ───────────────────────────────────────────
            builder.Services.AddMediatR(cfg =>
                cfg.RegisterServicesFromAssembly(
                    typeof(ExoPaperRAG.Application.Features.Papers.Queries.SearchHybridQuery).Assembly));

            // ─── Entity-linking (paper ↔ exoplanet) ───────────────────────
            builder.Services.AddSingleton<ExoplanetGazetteer>();

            // ─── Hosted services — RavenInitializer MUST be first ─────────
            builder.Services.AddHostedService<RavenInitializer>();
            builder.Services.AddHostedService<EmbeddingWorker>();
            builder.Services.AddHostedService<TaggingWorker>();
            builder.Services.AddHostedService<PaperLinkingWorker>();
            builder.Services.AddHostedService<OutboxDispatcher>();
            builder.Services.AddHostedService<OutboxCleanupService>();

            // ─── Health checks ────────────────────────────────────────────
            builder.Services.AddHealthChecks()
                .AddCheck<RavenHealthCheck>("ravendb", tags: new[] { "ready" })
                .AddCheck<OllamaHealthCheck>("ollama", tags: new[] { "ready" });

            // ─── Quartz.NET scheduled jobs ────────────────────────────────
            builder.Services.AddQuartz(q =>
            {
                var nasaJobKey = new JobKey("NasaSyncJob");
                q.AddJob<NasaSyncJob>(opts => opts.WithIdentity(nasaJobKey));
                q.AddTrigger(opts => opts
                    .ForJob(nasaJobKey)
                    .WithIdentity("NasaSyncTrigger")
                    .WithCronSchedule("0 0 2 * * ?")
                    .WithDescription("Daily NASA exoplanet sync"));

                var arxivJobKey = new JobKey("ArxivHarvesterJob");
                q.AddJob<ArxivHarvesterJob>(opts => opts.WithIdentity(arxivJobKey));
                q.AddTrigger(opts => opts
                    .ForJob(arxivJobKey)
                    .WithIdentity("ArxivHarvesterTrigger")
                    .WithCronSchedule("0 0 3 * * ?")
                    .WithDescription("Daily arXiv paper harvesting"));
            });

            builder.Services.AddQuartzHostedService(opts => opts.WaitForJobsToComplete = true);

            var app = builder.Build();

            // ─── HTTP pipeline ────────────────────────────────────────────
            app.UseExceptionHandler();

            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }
            else
            {
                app.UseHttpsRedirection();
            }

            app.UseCors("DefaultCors");
            app.UseAuthorization();

            app.MapControllers();
            app.MapHub<ExoPaperHub>("/hubs/exopaper");

            // Liveness: process is up. Readiness: dependencies are reachable.
            app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
            app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });
            app.MapHealthChecks("/health");

            app.Run();

            static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
            {
                return HttpPolicyExtensions
                    .HandleTransientHttpError()
                    .WaitAndRetryAsync(3, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)));
            }

            // arXiv flow-control 503s are handled inside ArxivClient (honouring Retry-After),
            // so this policy retries only connection faults and non-503 server errors.
            static IAsyncPolicy<HttpResponseMessage> GetArxivRetryPolicy()
            {
                return Policy<HttpResponseMessage>
                    .Handle<HttpRequestException>()
                    .OrResult(r => (int)r.StatusCode >= 500 &&
                                   r.StatusCode != System.Net.HttpStatusCode.ServiceUnavailable)
                    .WaitAndRetryAsync(3, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)));
            }

            static IAsyncPolicy<HttpResponseMessage> GetCircuitBreakerPolicy()
            {
                return HttpPolicyExtensions
                    .HandleTransientHttpError()
                    .CircuitBreakerAsync(5, TimeSpan.FromSeconds(30));
            }
        }
    }
}
