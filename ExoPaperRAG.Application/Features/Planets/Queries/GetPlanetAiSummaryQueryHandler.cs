using System.Globalization;
using System.Text;
using System.Text.Json;
using MediatR;
using Microsoft.Extensions.Logging;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;
using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Application.Common;
using ExoPaperRAG.Application.Indexes;
using ExoPaperRAG.Domain.Entities;

namespace ExoPaperRAG.Application.Features.Planets.Queries;

public class GetPlanetAiSummaryQueryHandler
    : IRequestHandler<GetPlanetAiSummaryQuery, PlanetAiSummaryResult>
{
    private readonly IDocumentStore _store;
    private readonly IOllamaClient _ollama;
    private readonly IExoplanetMeasurementSource _measurements;
    private readonly ILogger<GetPlanetAiSummaryQueryHandler> _logger;

    public GetPlanetAiSummaryQueryHandler(
        IDocumentStore store,
        IOllamaClient ollama,
        IExoplanetMeasurementSource measurements,
        ILogger<GetPlanetAiSummaryQueryHandler> logger)
    {
        _store = store;
        _ollama = ollama;
        _measurements = measurements;
        _logger = logger;
    }

    public async Task<PlanetAiSummaryResult> Handle(GetPlanetAiSummaryQuery request, CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();

        var planet = await session.LoadAsync<Exoplanet>(request.ExoplanetId, ct);
        if (planet == null)
        {
            return new PlanetAiSummaryResult
            {
                ExoplanetId = request.ExoplanetId,
                ShortSummary = "Exoplanet not found.",
            };
        }

        // Return cache unless regeneration is requested.
        if (!request.Regenerate && !string.IsNullOrEmpty(planet.CachedAiGeneralSummary))
        {
            try
            {
                var cached = JsonSerializer.Deserialize<PlanetAiSummaryResult>(planet.CachedAiGeneralSummary);
                if (cached is not null && !string.IsNullOrWhiteSpace(cached.KeyHighlights))
                    return cached;
                // Old-format cache (no KeyHighlights) → fall through to regeneration.
            }
            catch (JsonException) { /* cache invalid, regenerate */ }
        }

        // Gather literature: explicit links first, then a host-name fallback search.
        var docId = RavenIds.EnsurePrefix(request.ExoplanetId, "exoplanets/");
        var papers = await session.Query<Paper>()
            .Where(p => p.ExoplanetIds.Contains(docId))
            .Take(6)
            .ToListAsync(ct);

        if (papers.Count == 0)
        {
            var term = BuildHostSearchTerm(planet.Name);
            if (!string.IsNullOrWhiteSpace(term))
            {
                papers = await session.Query<Paper, Papers_ByAbstractSearch>()
                    .Search(x => x.Abstract, term)
                    .OrderByDescending(x => x.PublishedDate)
                    .Take(20)
                    .ToListAsync(ct);
            }
        }

        // Cross-fill missing catalog parameters from NASA "ps" table.
        var psFallback = await BuildPsFallbackAsync(planet, ct);

        var planetContext = BuildPlanetContext(planet, psFallback);

        // Deterministic fallback built purely from catalog parameters.
        var fallbackResult = BuildParameterFallback(planet, psFallback);

        string systemPrompt;
        string userPrompt;

        var jsonSchema = BuildJsonSchema();

        if (papers.Count > 0)
        {
            var contextBlock = string.Join("\n\n---\n\n", papers.Select((p, i) =>
                $"Paper {i + 1}: \"{p.Title}\"\n" +
                $"Published: {p.PublishedDate:yyyy-MM-dd}\n" +
                $"Abstract: {Truncate(p.Abstract, 450)}"));

            systemPrompt =
                "You are an expert astrophysics research assistant. Your task is to create a comprehensive, " +
                "structured profile of an exoplanet using the catalog parameters AND scientific literature provided.\n\n" +
                "Output ONLY valid JSON matching this exact schema (no markdown fences, no extra text):\n" +
                jsonSchema + "\n\n" +
                "IMPORTANT GUIDELINES:\n" +
                "- Write in English.\n" +
                "- Each field should be 2-5 sentences of engaging, scientifically accurate prose.\n" +
                "- key_highlights should be a markdown bulleted list (- item) of 3-5 notable facts.\n" +
                "- comparative_context MUST compare the planet numerically to Earth and/or Jupiter " +
                "(e.g., '3.2× the mass of Earth', '0.8× Jupiter's radius').\n" +
                "- habitability_assessment: STRICTLY evaluate habitability based on Equilibrium Temperature and orbital distance/period. If T_eq > 320K or period < 10 days, explicitly state it is far too hot for liquid water and NOT habitable.\n" +
                "- If a section has no relevant data, set it to an empty string.\n" +
                "- Do NOT invent specific measurements, but you MAY add well-established general " +
                "scientific context typical for this planet's class (e.g. expected composition, " +
                "what such worlds are usually like) so each section is informative.\n" +
                "- For reference: Earth mass = 1 M⊕, Jupiter mass = 317.8 M⊕, Earth radius = 1 R⊕, Jupiter radius = 11.2 R⊕.";

            userPrompt =
                $"=== CATALOG PARAMETERS ===\n{planetContext}\n\n=== SCIENTIFIC LITERATURE ===\n{contextBlock}\n\n" +
                $"=== TASK ===\nUsing the data above, output ONLY the JSON planet profile for {planet.Name} " +
                "exactly matching the schema. Describe the PLANET, not the papers. No markdown fences, no extra text.";
        }
        else
        {
            systemPrompt =
                "You are an expert astrophysics research assistant. No publications are available for " +
                "this exoplanet, so create a structured profile strictly from the catalog parameters provided. " +
                "Do NOT invent measurements.\n\n" +
                "Output ONLY valid JSON matching this exact schema (no markdown fences, no extra text):\n" +
                jsonSchema + "\n\n" +
                "GUIDELINES:\n" +
                "- Write in English.\n" +
                "- Each field should be 2-4 sentences. Combine the catalog parameters with " +
                "well-established general knowledge about this planet's class to make every " +
                "applicable section informative; only leave a section empty if nothing meaningful " +
                "can be said. Do NOT invent specific unmeasured numbers.\n" +
                "- key_highlights: markdown bulleted list (- item) of 3-5 facts.\n" +
                "- habitability_assessment: STRICTLY evaluate habitability based on Equilibrium Temperature and orbital distance/period. If T_eq > 320K or period < 10 days, explicitly state it is far too hot for liquid water and NOT habitable.\n" +
                "- comparative_context: compare to Earth and/or Jupiter numerically.\n" +
                "- literature_synthesis: set to empty string (no papers available).\n" +
                "- For reference: Earth mass = 1 M⊕, Jupiter mass = 317.8 M⊕, Earth radius = 1 R⊕, Jupiter radius = 11.2 R⊕.";

            userPrompt = $"=== CATALOG PARAMETERS ===\n{planetContext}\n\n" +
                $"=== TASK ===\nOutput ONLY the JSON planet profile for {planet.Name} exactly matching the " +
                "schema. No markdown fences, no extra text.";
        }

        PlanetAiSummaryResult result;
        try
        {
            var rawResponse = await _ollama.GenerateAsync(userPrompt, systemPrompt, ct, jsonMode: true);
            var parsed = ParseStructuredSummary(rawResponse, request.ExoplanetId, planet.Name);

            // Model returned prose instead of JSON (or empty) → use the deterministic,
            // structured parameter profile rather than caching a garbage ramble.
            if (parsed is null ||
                (string.IsNullOrWhiteSpace(parsed.ShortSummary) && string.IsNullOrWhiteSpace(parsed.KeyHighlights)))
            {
                _logger.LogWarning("AI synthesis for '{Planet}' returned no valid JSON; using parameter fallback.", planet.Name);
                return fallbackResult;
            }

            result = parsed;

            // Cache the genuine model output.
            planet.CachedAiGeneralSummary = JsonSerializer.Serialize(result);
            await session.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "AI synthesis for '{Planet}' fell back to parameter-only summary (model unavailable or slow).",
                planet.Name);

            result = fallbackResult;
        }

        return result;
    }

    // ── JSON schema for structured output ───────────────────────────────────
    private static string BuildJsonSchema() =>
        """
        {
          "planet_type": "classification like Gas Giant, Super-Earth, Sub-Neptune, Terrestrial, Neptune-like",
          "short_summary": "3-4 sentence engaging overview",
          "key_highlights": "- bullet point 1\n- bullet point 2\n- bullet point 3",
          "habitability_assessment": "assessment of habitability potential",
          "comparative_context": "comparison to Earth and Jupiter with exact multiples",
          "atmosphere_climate": "atmosphere and climate analysis",
          "orbital_dynamics": "orbital characteristics description",
          "host_star_analysis": "host star characterization",
          "literature_synthesis": "what the papers say (or empty if none)",
          "open_questions": "unanswered questions and future research directions"
        }
        """;

    // ── Parse structured JSON ───────────────────────────────────────────────
    private static PlanetAiSummaryResult? ParseStructuredSummary(string raw, string exoplanetId, string? name)
    {
        try
        {
            var json = raw.Trim();
            var start = json.IndexOf('{');
            var end = json.LastIndexOf('}');
            if (start >= 0 && end >= start)
                json = json.Substring(start, end - start + 1);

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            string Get(string key) =>
                root.TryGetProperty(key, out var v) ? v.GetString() ?? "" : "";

            var shortSummary = Get("short_summary");
            var detailed = new StringBuilder();
            if (!string.IsNullOrWhiteSpace(shortSummary)) detailed.AppendLine(shortSummary);
            var lit = Get("literature_synthesis");
            if (!string.IsNullOrWhiteSpace(lit)) detailed.AppendLine("\n" + lit);

            return new PlanetAiSummaryResult
            {
                ExoplanetId = exoplanetId,
                ExoplanetName = name,
                PlanetType = Get("planet_type"),
                ShortSummary = shortSummary,
                KeyHighlights = Get("key_highlights"),
                HabitabilityAssessment = Get("habitability_assessment"),
                ComparativeContext = Get("comparative_context"),
                AtmosphereClimate = Get("atmosphere_climate"),
                OrbitalDynamics = Get("orbital_dynamics"),
                HostStarAnalysis = Get("host_star_analysis"),
                LiteratureSynthesis = lit,
                OpenQuestions = Get("open_questions"),
                DetailedSummary = detailed.ToString().Trim()
            };
        }
        catch
        {
            // Model returned prose instead of valid JSON — signal failure so the caller
            // can fall back to the deterministic, structured parameter profile.
            return null;
        }
    }

    // ── ps cross-fill ───────────────────────────────────────────────────────
    private async Task<Dictionary<string, double>> BuildPsFallbackAsync(Exoplanet p, CancellationToken ct)
    {
        var needsFill = !p.MassEarth.HasValue || !p.RadiusEarth.HasValue ||
                        !p.OrbitalPeriodDays.HasValue || !p.SemiMajorAxisAu.HasValue ||
                        !p.Eccentricity.HasValue || !p.EquilibriumTemperatureK.HasValue;

        if (!needsFill)
            return new Dictionary<string, double>();

        try
        {
            var measurements = await _measurements.GetMeasurementsAsync(p.Name, ct);
            return measurements
                .GroupBy(m => m.Parameter)
                .ToDictionary(
                    g => g.Key,
                    g => (g.FirstOrDefault(m => m.IsDefault) ?? g.First()).Value);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "ps cross-fill lookup failed for '{Planet}'.", p.Name);
            return new Dictionary<string, double>();
        }
    }

    // ── Prompt context ───────────────────────────────────────────────────
    private static string BuildPlanetContext(Exoplanet p, IReadOnlyDictionary<string, double> psFallback)
    {
        var sb = new StringBuilder();
        void Line(string label, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
                sb.AppendLine($"{label}: {value}");
        }

        void Num(string label, double? entityVal, string psKey, int decimals, bool derived = false)
        {
            if (entityVal.HasValue)
                Line(label, Fmt(entityVal, decimals, derived));
            else if (psFallback.TryGetValue(psKey, out var v))
                Line(label, Fmt(v, decimals) + " (from ps)");
        }

        Line("Name", p.Name);
        Line("Discovery method", p.DiscoveryMethod);
        Line("Discovery year", p.DiscoveryYear?.ToString());
        Line("Discovery facility", p.DiscoveryFacility);
        Line("Host star", p.HostName);
        Line("Spectral type", p.SpectralType);
        Num("Mass (Earth)", p.MassEarth, "Mass", 2, p.MassIsDerived);
        Line("Mass (Jupiter)", Fmt(p.MassJupiter, 3));
        Line("Mass provenance", p.MassProvenance);
        Num("Radius (Earth)", p.RadiusEarth, "Radius", 2, p.RadiusIsDerived);
        Line("Density (g/cm^3)", Fmt(p.DensityGramPerCm3, 2));
        Num("Orbital period (days)", p.OrbitalPeriodDays, "Orbital Period", 2);
        Num("Semi-major axis (AU)", p.SemiMajorAxisAu, "Semi-Major Axis", 3);
        Num("Eccentricity", p.Eccentricity, "Eccentricity", 3);
        Line("Inclination (deg)", Fmt(p.InclinationDeg, 1));
        Num("Equilibrium temperature (K)", p.EquilibriumTemperatureK, "Equilibrium Temp.", 0, p.EquilibriumTemperatureIsDerived);
        Line("Insolation (Earth flux)", Fmt(p.InsolationFlux, 2));
        Line("Stellar T_eff (K)", Fmt(p.StellarEffectiveTemperatureK, 0));
        Line("Stellar radius (Sun)", Fmt(p.StellarRadiusSolar, 2));
        Line("Stellar mass (Sun)", Fmt(p.StellarMassSolar, 2));
        Line("Stellar age (Gyr)", Fmt(p.StellarAgeGyr, 2));
        Line("Stellar metallicity [Fe/H]", Fmt(p.StellarMetallicity, 2));
        Line("Distance (pc)", Fmt(p.DistanceParsecs, 1));
        Line("Number of planets in system", p.NumberOfPlanets?.ToString());
        if (p.IsControversial == true)
            Line("Note", "Flagged as a controversial detection");

        return sb.ToString().TrimEnd();
    }

    // ── Deterministic parameter-based fallback ───────────────────────────
    private static PlanetAiSummaryResult BuildParameterFallback(
        Exoplanet p, IReadOnlyDictionary<string, double> psFallback)
    {
        var type = ClassifyByMassRadius(p);
        var typeName = type ?? "Unknown";

        var shortSb = new StringBuilder();
        shortSb.Append($"{p.Name} is an exoplanet");
        if (!string.IsNullOrWhiteSpace(p.HostName))
            shortSb.Append($" orbiting the star {p.HostName}");
        if (!string.IsNullOrWhiteSpace(p.DiscoveryMethod))
            shortSb.Append($", discovered via {p.DiscoveryMethod.ToLowerInvariant()}");
        if (p.DiscoveryYear.HasValue)
            shortSb.Append($" in {p.DiscoveryYear}");
        shortSb.Append('.');

        // Key highlights
        var highlights = new StringBuilder();
        if (p.MassEarth.HasValue)
            highlights.AppendLine($"- Mass: {p.MassEarth:F2} Earth masses ({p.MassEarth / 317.828:F3} Jupiter masses)");
        if (p.RadiusEarth.HasValue)
            highlights.AppendLine($"- Radius: {p.RadiusEarth:F2} Earth radii ({p.RadiusEarth / 11.209:F3} Jupiter radii)");
        if (p.OrbitalPeriodDays.HasValue)
            highlights.AppendLine($"- Orbital period: {p.OrbitalPeriodDays:F2} days");
        if (p.EquilibriumTemperatureK.HasValue)
            highlights.AppendLine($"- Equilibrium temperature: {p.EquilibriumTemperatureK:F0} K ({p.EquilibriumTemperatureK - 273.15:F0} °C)");
        if (p.DistanceParsecs.HasValue)
            highlights.AppendLine($"- Distance: {p.DistanceParsecs:F1} parsecs ({p.DistanceParsecs * 3.26156:F1} light-years)");

        // Comparative context
        var comp = new StringBuilder();
        if (p.MassEarth.HasValue)
            comp.Append($"This planet has {p.MassEarth:F1}× the mass of Earth. ");
        if (p.RadiusEarth.HasValue)
            comp.Append($"Its radius is {p.RadiusEarth:F1}× that of Earth. ");
        if (p.MassEarth.HasValue && p.MassEarth > 50)
            comp.Append($"Compared to Jupiter, it is {p.MassEarth / 317.828:F2}× its mass. ");

        // Habitability
        var hab = new StringBuilder();
        if (p.EquilibriumTemperatureK.HasValue)
        {
            var teq = p.EquilibriumTemperatureK.Value;
            if (teq >= 200 && teq <= 320)
                hab.Append("The equilibrium temperature falls within a potentially habitable range. ");
            else if (teq > 320)
                hab.Append($"At {teq:F0} K, the planet is too hot for liquid water on the surface. ");
            else
                hab.Append($"At {teq:F0} K, the planet is likely too cold for surface liquid water. ");
        }

        // Orbital
        var orb = new StringBuilder();
        if (p.OrbitalPeriodDays.HasValue)
            orb.Append($"The planet orbits its star every {p.OrbitalPeriodDays:F2} days. ");
        if (p.SemiMajorAxisAu.HasValue)
            orb.Append($"The semi-major axis is {p.SemiMajorAxisAu:F3} AU. ");
        if (p.Eccentricity.HasValue)
            orb.Append($"Eccentricity: {p.Eccentricity:F3}. ");

        // Host star
        var star = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(p.HostName))
            star.Append($"Host star: {p.HostName}. ");
        if (!string.IsNullOrWhiteSpace(p.SpectralType))
            star.Append($"Spectral type: {p.SpectralType}. ");
        if (p.StellarEffectiveTemperatureK.HasValue)
            star.Append($"Effective temperature: {p.StellarEffectiveTemperatureK:F0} K. ");
        if (p.StellarMassSolar.HasValue)
            star.Append($"Mass: {p.StellarMassSolar:F2} M☉. ");

        return new PlanetAiSummaryResult
        {
            ExoplanetId = p.Id,
            ExoplanetName = p.Name,
            PlanetType = typeName,
            ShortSummary = shortSb.ToString(),
            KeyHighlights = highlights.ToString().TrimEnd(),
            HabitabilityAssessment = hab.ToString().TrimEnd(),
            ComparativeContext = comp.ToString().TrimEnd(),
            AtmosphereClimate = "",
            OrbitalDynamics = orb.ToString().TrimEnd(),
            HostStarAnalysis = star.ToString().TrimEnd(),
            LiteratureSynthesis = "",
            OpenQuestions = "",
            DetailedSummary = BuildPlanetContext(p, psFallback)
        };
    }

    private static string? ClassifyByMassRadius(Exoplanet p)
    {
        var r = p.RadiusEarth;
        var m = p.MassEarth;

        if (r.HasValue)
        {
            if (r < 1.6) return "Terrestrial";
            if (r < 4) return "Sub-Neptune";
            if (r < 10) return "Neptune-like";
            return "Gas Giant";
        }
        if (m.HasValue)
        {
            if (m < 2) return "Terrestrial";
            if (m < 10) return "Super-Earth";
            if (m < 50) return "Neptune-like";
            return "Gas Giant";
        }
        return null;
    }

    // ── Helpers ──────────────────────────────────────────────────────────
    private static string? Fmt(double? value, int decimals, bool derived = false)
    {
        if (!value.HasValue) return null;
        var text = value.Value.ToString("F" + decimals, CultureInfo.InvariantCulture);
        return derived ? text + " (estimated)" : text;
    }

    private static string Truncate(string? text, int maxLength)
    {
        if (string.IsNullOrEmpty(text)) return "(No abstract available)";
        return text.Length <= maxLength ? text : text[..maxLength] + "...";
    }

    private static string? BuildHostSearchTerm(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        var trimmed = name.Trim();
        var lastSpace = trimmed.LastIndexOf(' ');
        if (lastSpace > 0 && trimmed.Length - lastSpace <= 3) // " b", " AB", " bc"
            trimmed = trimmed[..lastSpace];
        return trimmed.Trim();
    }
}
