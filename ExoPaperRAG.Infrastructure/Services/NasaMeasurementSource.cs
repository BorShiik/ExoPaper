using System.Text.RegularExpressions;
using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Domain;
using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Infrastructure.Models;
using Microsoft.Extensions.Logging;

namespace ExoPaperRAG.Infrastructure.Services;

/// <summary>
/// Per-publication measurement source backed by the NASA "ps" table. For a given planet it
/// fetches every published row and explodes each into individual <see cref="ParameterMeasurement"/>
/// values (mass, radius, period, semi-major axis, eccentricity, equilibrium temperature) with
/// their asymmetric error bars and reference.
/// </summary>
public sealed class NasaMeasurementSource : IExoplanetMeasurementSource
{
    private readonly INasaClient _nasa;
    private readonly ILogger<NasaMeasurementSource> _logger;

    public NasaMeasurementSource(INasaClient nasa, ILogger<NasaMeasurementSource> logger)
    {
        _nasa = nasa;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ParameterMeasurement>> GetMeasurementsAsync(
        string planetName, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(planetName))
            return Array.Empty<ParameterMeasurement>();

        var safeName = planetName.Replace("'", "''"); // ADQL string-literal escaping
        var query = new AdqlQueryBuilder()
            .Select(
                "pl_name", "pl_refname", "default_flag",
                "pl_bmasse", "pl_bmasseerr1", "pl_bmasseerr2",
                "pl_rade", "pl_radeerr1", "pl_radeerr2",
                "pl_orbper", "pl_orbpererr1", "pl_orbpererr2",
                "pl_orbsmax", "pl_orbsmaxerr1", "pl_orbsmaxerr2",
                "pl_orbeccen", "pl_orbeccenerr1", "pl_orbeccenerr2",
                "pl_eqt", "pl_eqterr1", "pl_eqterr2")
            .From(NasaTables.AllPublications)
            .Where("pl_name", "=", safeName)
            .Build();

        List<PlanetMeasurementDto> rows;
        try
        {
            rows = await _nasa.FetchMeasurementsAsync(query, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch NASA ps measurements for '{Planet}'.", planetName);
            return Array.Empty<ParameterMeasurement>();
        }

        var measurements = new List<ParameterMeasurement>();
        foreach (var r in rows)
        {
            var reference = StripHtml(r.Reference);
            var isDefault = r.DefaultFlag is > 0.5;

            Add(measurements, "Mass", "M⊕", r.MassEarth, r.MassEarthErr1, r.MassEarthErr2, reference, isDefault);
            Add(measurements, "Radius", "R⊕", r.RadiusEarth, r.RadiusEarthErr1, r.RadiusEarthErr2, reference, isDefault);
            Add(measurements, "Orbital Period", "d", r.OrbitalPeriodDays, r.OrbitalPeriodErr1, r.OrbitalPeriodErr2, reference, isDefault);
            Add(measurements, "Semi-Major Axis", "AU", r.SemiMajorAxisAu, r.SemiMajorAxisErr1, r.SemiMajorAxisErr2, reference, isDefault);
            Add(measurements, "Eccentricity", "", r.Eccentricity, r.EccentricityErr1, r.EccentricityErr2, reference, isDefault);
            Add(measurements, "Equilibrium Temp.", "K", r.EquilibriumTemperatureK, r.EquilibriumTemperatureErr1, r.EquilibriumTemperatureErr2, reference, isDefault);
        }

        return measurements;
    }

    private static void Add(
        List<ParameterMeasurement> list,
        string parameter, string unit,
        double? value, double? err1, double? err2,
        string? reference, bool isDefault)
    {
        if (!value.HasValue)
            return;

        list.Add(new ParameterMeasurement
        {
            Parameter = parameter,
            Unit = unit,
            Value = value.Value,
            ErrorPlus = err1.HasValue ? Math.Abs(err1.Value) : null,
            ErrorMinus = err2.HasValue ? Math.Abs(err2.Value) : null,
            Reference = reference,
            IsDefault = isDefault
        });
    }

    /// <summary>NASA reference fields are HTML anchors; reduce them to plain display text.</summary>
    private static string? StripHtml(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var text = Regex.Replace(value, "<.*?>", string.Empty);
        text = Regex.Replace(text, @"\s+", " ").Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }
}
