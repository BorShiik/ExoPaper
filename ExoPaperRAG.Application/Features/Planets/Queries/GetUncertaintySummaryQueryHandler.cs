using MediatR;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;
using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Domain.Entities;

namespace ExoPaperRAG.Application.Features.Planets.Queries;

/// <summary>
/// Handler for Uncertainty Tracking:
/// 1. Loads the exoplanet and all papers referencing it (via Include).
/// 2. Extracts conflicting measurement data from paper abstracts.
/// 3. Sends context to llama3 with a system prompt to generate an analytical summary.
/// </summary>
public class GetUncertaintySummaryQueryHandler
    : IRequestHandler<GetUncertaintySummaryQuery, UncertaintySummaryResult>
{
    private readonly IDocumentStore _store;
    private readonly IOllamaClient _ollama;

    public GetUncertaintySummaryQueryHandler(IDocumentStore store, IOllamaClient ollama)
    {
        _store = store;
        _ollama = ollama;
    }

    public async Task<UncertaintySummaryResult> Handle(GetUncertaintySummaryQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();

        // Step 1: Load the exoplanet
        var planet = await session.LoadAsync<Exoplanet>(request.ExoplanetId, ct);
        if (planet == null)
        {
            return new UncertaintySummaryResult
            {
                ExoplanetId = request.ExoplanetId,
                AnalysisSummary = "Exoplanet not found."
            };
        }

        // Step 2: Find all papers that reference this exoplanet
        var papers = await session.Query<Paper>()
            .Where(p => p.ExoplanetIds.Contains(request.ExoplanetId))
            .Take(20) // Limit to avoid too large context
            .ToListAsync(ct);

        if (papers.Count < 2)
        {
            return new UncertaintySummaryResult
            {
                ExoplanetId = request.ExoplanetId,
                ExoplanetName = planet.Name,
                AnalysisSummary = "Not enough papers reference this exoplanet to identify measurement conflicts."
            };
        }

        // Step 3: Build context for the LLM
        var conflicts = papers.Select(p => new ConflictingMeasurement
        {
            PaperTitle = p.Title,
            PaperId = p.Id,
            RelevantText = TruncateAbstract(p.Abstract, 500)
        }).ToList();

        var contextBlock = string.Join("\n\n---\n\n", papers.Select((p, i) =>
            $"Paper {i + 1}: \"{p.Title}\"\n" +
            $"Published: {p.PublishedDate:yyyy-MM-dd}\n" +
            $"Abstract: {TruncateAbstract(p.Abstract, 500)}"));

        var planetContext =
            $"Planet: {planet.Name}\n" +
            $"Mass (Earth): {planet.MassEarth?.ToString("F4") ?? "N/A"}\n" +
            $"Radius (Earth): {planet.RadiusEarth?.ToString("F4") ?? "N/A"}\n" +
            $"Discovery Method: {planet.DiscoveryMethod ?? "N/A"}\n" +
            $"Semi-Major Axis (AU): {planet.SemiMajorAxisAu?.ToString("F4") ?? "N/A"}\n" +
            $"Orbital Period (days): {planet.OrbitalPeriodDays?.ToString("F4") ?? "N/A"}";

        var systemPrompt =
            "You are an astrophysics research assistant. Analyze the following " +
            "papers that reference the same exoplanet. Identify any conflicting " +
            "or inconsistent measurements (mass, radius, orbital parameters, etc.) " +
            "between the papers. Explain possible reasons for the discrepancies " +
            "(e.g., different measurement techniques, updated models, stellar jitter). " +
            "Provide a structured summary in 3-5 bullet points. Be concise and scientific.";

        var userPrompt =
            $"=== EXOPLANET DATA ===\n{planetContext}\n\n" +
            $"=== PAPERS ===\n{contextBlock}";

        // Step 4: Generate analytical summary via LLM
        var summary = await _ollama.GenerateAsync(userPrompt, systemPrompt, ct);

        return new UncertaintySummaryResult
        {
            ExoplanetId = request.ExoplanetId,
            ExoplanetName = planet.Name,
            AnalysisSummary = summary,
            Conflicts = conflicts
        };
    }

    private static string TruncateAbstract(string? text, int maxLength)
    {
        if (string.IsNullOrEmpty(text)) return "(No abstract available)";
        return text.Length <= maxLength ? text : text[..maxLength] + "...";
    }
}
