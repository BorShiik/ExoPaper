using ExoPaperRAG.Domain.Entities;

namespace ExoPaperRAG.Application.Abstractions;

/// <summary>
/// Provides per-publication measurements (with error bars) for a planet, used by the
/// uncertainty / discrepancy tracker. Implemented in Infrastructure against the NASA
/// "ps" table; abstracted here so the Application layer stays catalog-agnostic.
/// </summary>
public interface IExoplanetMeasurementSource
{
    Task<IReadOnlyList<ParameterMeasurement>> GetMeasurementsAsync(
        string planetName, CancellationToken ct = default);
}
