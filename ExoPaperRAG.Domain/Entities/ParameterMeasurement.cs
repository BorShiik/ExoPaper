namespace ExoPaperRAG.Domain.Entities;

/// <summary>
/// A single published measurement of one planetary parameter, with its asymmetric error bars
/// and the reference it came from. Sourced from the NASA "ps" table (one row per publication),
/// these are the raw inputs for uncertainty / discrepancy tracking.
/// </summary>
public record ParameterMeasurement
{
    public string Parameter { get; init; } = string.Empty; // e.g. "Mass (M⊕)"
    public string Unit { get; init; } = string.Empty;
    public double Value { get; init; }
    public double? ErrorPlus { get; init; }
    public double? ErrorMinus { get; init; }
    public string? Reference { get; init; }
    public bool IsDefault { get; init; }
}

/// <summary>
/// Aggregated view of all measurements of a single parameter across publications: the spread,
/// the default (adopted) value, and whether the measurements disagree beyond a threshold.
/// </summary>
public record ParameterDisparity
{
    public string Parameter { get; init; } = string.Empty;
    public string Unit { get; init; } = string.Empty;
    public int Count { get; init; }
    public double Min { get; init; }
    public double Max { get; init; }
    public double Mean { get; init; }
    public double? DefaultValue { get; init; }
    /// <summary>Relative spread: (max − min) / |mean| · 100. 0 when a single measurement exists.</summary>
    public double SpreadPercent { get; init; }
    /// <summary>True when the spread exceeds the conflict threshold (measurements disagree).</summary>
    public bool IsConflicting { get; init; }
    public List<ParameterMeasurement> Measurements { get; init; } = new();
}
