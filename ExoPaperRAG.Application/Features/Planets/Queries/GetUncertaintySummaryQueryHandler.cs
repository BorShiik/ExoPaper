using System.Globalization;
using System.Text;
using System.Text.Json;
using MediatR;
using Microsoft.Extensions.Logging;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;
using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Application.Common;
using ExoPaperRAG.Domain.Entities;

namespace ExoPaperRAG.Application.Features.Planets.Queries;

/// <summary>
/// Data-driven uncertainty tracking. Instead of asking an LLM to guess at conflicts from
/// abstracts, it pulls every published measurement of the planet's key parameters from the
/// NASA "ps" table, computes the spread per parameter, and flags genuine disagreements.
/// The result is deterministic and always available (never depends on the model server).
/// </summary>
public class GetUncertaintySummaryQueryHandler
    : IRequestHandler<GetUncertaintySummaryQuery, UncertaintySummaryResult>
{
    private readonly IDocumentStore _store;
    private readonly IExoplanetMeasurementSource _measurements;
    private readonly ILogger<GetUncertaintySummaryQueryHandler> _logger;

    // A parameter whose relative spread exceeds this is considered "in conflict".
    private const double ConflictThresholdPercent = 10.0;

    public GetUncertaintySummaryQueryHandler(
        IDocumentStore store,
        IExoplanetMeasurementSource measurements,
        ILogger<GetUncertaintySummaryQueryHandler> logger)
    {
        _store = store;
        _measurements = measurements;
        _logger = logger;
    }

    public async Task<UncertaintySummaryResult> Handle(GetUncertaintySummaryQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();

        var planet = await session.LoadAsync<Exoplanet>(request.ExoplanetId, ct);
        if (planet == null)
        {
            return new UncertaintySummaryResult
            {
                ExoplanetId = request.ExoplanetId,
                AnalysisSummary = "Exoplanet not found."
            };
        }

        // Cache hit.
        if (!request.Regenerate && !string.IsNullOrEmpty(planet.CachedUncertaintySummary))
        {
            try
            {
                var cached = JsonSerializer.Deserialize<UncertaintySummaryResult>(planet.CachedUncertaintySummary);
                if (cached is not null)
                    return cached;
            }
            catch (JsonException) { /* corrupt cache → regenerate */ }
        }

        // Pull every published measurement of this planet's parameters.
        var measurements = await _measurements.GetMeasurementsAsync(planet.Name, ct);
        var disparities = BuildDisparities(measurements);

        // Secondary: papers that reference the planet (literature context for the UI).
        var docId = RavenIds.EnsurePrefix(request.ExoplanetId, "exoplanets/");
        var papers = await session.Query<Paper>()
            .Where(p => p.ExoplanetIds.Contains(docId))
            .Take(20)
            .ToListAsync(ct);

        var conflicts = papers.Select(p => new ConflictingMeasurement
        {
            PaperTitle = p.Title,
            PaperId = p.Id,
            RelevantText = Truncate(p.Abstract, 500)
        }).ToList();

        var result = new UncertaintySummaryResult
        {
            ExoplanetId = request.ExoplanetId,
            ExoplanetName = planet.Name,
            AnalysisSummary = BuildSummary(planet.Name, disparities),
            Disparities = disparities,
            Conflicts = conflicts
        };

        // Cache the computed analysis on the planet document.
        try
        {
            planet.CachedUncertaintySummary = JsonSerializer.Serialize(result);
            await session.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to cache uncertainty analysis for '{Planet}'.", planet.Name);
        }

        return result;
    }

    /// <summary>Groups raw measurements by parameter and computes spread / conflict flags.</summary>
    private static List<ParameterDisparity> BuildDisparities(IReadOnlyList<ParameterMeasurement> measurements)
    {
        return measurements
            .GroupBy(m => m.Parameter)
            .Select(g =>
            {
                var values = g.Select(m => m.Value).ToList();
                var min = values.Min();
                var max = values.Max();
                var mean = values.Average();
                var spread = Math.Abs(mean) > 1e-9 ? (max - min) / Math.Abs(mean) * 100.0 : 0.0;
                var defaultMeasurement = g.FirstOrDefault(m => m.IsDefault) ?? g.First();

                return new ParameterDisparity
                {
                    Parameter = g.Key,
                    Unit = g.First().Unit,
                    Count = values.Count,
                    Min = min,
                    Max = max,
                    Mean = mean,
                    DefaultValue = defaultMeasurement.Value,
                    SpreadPercent = Math.Round(spread, 1),
                    IsConflicting = values.Count > 1 && spread > ConflictThresholdPercent,
                    Measurements = g
                        .OrderByDescending(m => m.IsDefault)
                        .ThenBy(m => m.Value)
                        .ToList()
                };
            })
            .OrderByDescending(d => d.IsConflicting)
            .ThenByDescending(d => d.SpreadPercent)
            .ToList();
    }

    /// <summary>Deterministic, human-readable analysis text built from the computed disparities.</summary>
    private static string BuildSummary(string planetName, List<ParameterDisparity> disparities)
    {
        if (disparities.Count == 0)
            return $"No published measurements with error bars were found for {planetName} in the NASA catalog, " +
                   "so a quantitative discrepancy analysis is not possible yet.";

        var totalSources = disparities.SelectMany(d => d.Measurements)
            .Select(m => m.Reference)
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Distinct()
            .Count();

        var conflicting = disparities.Where(d => d.IsConflicting).ToList();

        var sb = new StringBuilder();
        sb.AppendLine($"Cross-publication analysis of **{planetName}** across {totalSources} reference(s):");
        sb.AppendLine();

        if (conflicting.Count == 0)
        {
            sb.AppendLine("- Published measurements are broadly **consistent** — no parameter exceeds the " +
                          $"{ConflictThresholdPercent:F0}% spread threshold.");
        }
        else
        {
            sb.AppendLine($"- **{conflicting.Count} parameter(s) show notable disagreement** between sources:");
            foreach (var d in conflicting)
            {
                sb.AppendLine(
                    $"  - **{d.Parameter}**: ranges {Num(d.Min)}–{Num(d.Max)} {d.Unit} " +
                    $"across {d.Count} measurements (≈{d.SpreadPercent:F0}% spread).");
            }
        }

        var agreeing = disparities.Where(d => !d.IsConflicting && d.Count > 1).ToList();
        if (agreeing.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("- Consistent parameters: " +
                          string.Join(", ", agreeing.Select(d => $"{d.Parameter} ({d.Count} meas.)")) + ".");
        }

        return sb.ToString().TrimEnd();
    }

    private static string Num(double v) => v.ToString("G4", CultureInfo.InvariantCulture);

    private static string Truncate(string? text, int maxLength)
    {
        if (string.IsNullOrEmpty(text)) return "(No abstract available)";
        return text.Length <= maxLength ? text : text[..maxLength] + "...";
    }
}
