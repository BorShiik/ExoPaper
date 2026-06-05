
using Polly;
using Polly.Extensions.Http;
using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Infrastructure.Services;
using ExoPaperRAG.Infrastructure.Settings;
using ExoPaperRAG.Infrastructure.Workers;
using Raven.Client.Documents;
using Raven.Client.Documents.Indexes;
using Microsoft.Extensions.Options;
using ExoPaperRAG.Infrastructure.Indexes;
using ExoPaperRAG.Infrastructure.Jobs;
using Quartz;

namespace ExoPaperRAG.Api
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.

            builder.Services.AddControllers();
            // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
            builder.Services.AddOpenApi();

            builder.Services.Configure<NasaApiSettings>(builder.Configuration.GetSection(NasaApiSettings.SectionName));
            builder.Services.Configure<ArxivSettings>(builder.Configuration.GetSection(ArxivSettings.SectionName));
            
            builder.Services.Configure<RavenSettings>(builder.Configuration.GetSection(RavenSettings.SectionName));
            builder.Services.AddSingleton<IDocumentStore>(sp =>
            {
                var settings = sp.GetRequiredService<IOptions<RavenSettings>>().Value;
                var store = new DocumentStore
                {
                    Urls = settings.Urls,
                    Database = settings.DatabaseName
                };
                store.Conventions.DisableTopologyUpdates = true;
                store.Initialize();

                IndexCreation.CreateIndexes(typeof(Exoplanets_ByHabitability).Assembly, store);

                return store;
            });

            // NASA HTTP client with Polly resilience
            builder.Services.AddHttpClient<INasaClient, NasaClient>()
                .AddPolicyHandler(GetRetryPolicy())
                .AddPolicyHandler(GetCircuitBreakerPolicy());

            // arXiv HTTP client with Polly resilience
            builder.Services.AddHttpClient<IArxivClient, ArxivClient>()
                .AddPolicyHandler(GetRetryPolicy());

            // ─── Ollama (AI / LLM) ──────────────────────────────────────
            builder.Services.Configure<OllamaSettings>(builder.Configuration.GetSection(OllamaSettings.SectionName));
            builder.Services.AddHttpClient<IOllamaClient, OllamaClient>()
                .AddPolicyHandler(GetRetryPolicy());

            // ─── EmbeddingWorker (RavenDB Data Subscription → Ollama) ───
            builder.Services.AddHostedService<EmbeddingWorker>();

            // ─── MediatR (CQRS) ─────────────────────────────────────────
            builder.Services.AddMediatR(cfg =>
                cfg.RegisterServicesFromAssembly(typeof(ExoPaperRAG.Application.Features.Papers.Queries.SearchHybridQuery).Assembly));

            // ─── Quartz.NET ───────────────────────────────────────────────
            builder.Services.AddQuartz(q =>
            {
                // NASA Sync Job — runs daily at 02:00 UTC
                var nasaJobKey = new JobKey("NasaSyncJob");
                q.AddJob<NasaSyncJob>(opts => opts.WithIdentity(nasaJobKey));
                q.AddTrigger(opts => opts
                    .ForJob(nasaJobKey)
                    .WithIdentity("NasaSyncTrigger")
                    .WithCronSchedule("0 0 2 * * ?") // Every day at 02:00
                    .WithDescription("Daily NASA exoplanet sync"));

                // arXiv Harvester Job — runs daily at 03:00 UTC
                var arxivJobKey = new JobKey("ArxivHarvesterJob");
                q.AddJob<ArxivHarvesterJob>(opts => opts.WithIdentity(arxivJobKey));
                q.AddTrigger(opts => opts
                    .ForJob(arxivJobKey)
                    .WithIdentity("ArxivHarvesterTrigger")
                    .WithCronSchedule("0 0 3 * * ?") // Every day at 03:00
                    .WithDescription("Daily arXiv paper harvesting"));
            });

            builder.Services.AddQuartzHostedService(opts =>
            {
                opts.WaitForJobsToComplete = true;
            });

            var app = builder.Build();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }

            if (!app.Environment.IsDevelopment())
            {
                app.UseHttpsRedirection();
            }

            app.UseAuthorization();


            app.MapControllers();

            app.Run();

            static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
            {
                return HttpPolicyExtensions
                    .HandleTransientHttpError()
                    .WaitAndRetryAsync(3, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                    onRetry: (outcome, timespan, retryCount, context) =>
                    {
                        Console.WriteLine($"[WARNING] HTTP error. Retry: {retryCount}. Waiting: {timespan.TotalSeconds} s");
                    });
            }

            static IAsyncPolicy<HttpResponseMessage> GetCircuitBreakerPolicy()
            {
                return HttpPolicyExtensions
                    .HandleTransientHttpError()
                    .CircuitBreakerAsync(5, TimeSpan.FromSeconds(30), 
                    onBreak: (outcome, timespan) =>
                    {
                        Console.WriteLine($"[CRITICAL] Circuit Broken! Waiting for {timespan.TotalSeconds} s before trying again.");
                    },
                    onReset: () => 
                    {
                        Console.WriteLine("[INFO] Circuit Reset. Normal operation resumed.");
                    });
            }
        }
    }
}

