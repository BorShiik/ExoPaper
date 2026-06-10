using System.ComponentModel.DataAnnotations;

namespace ExoPaperRAG.Infrastructure.Settings;

public class ArxivSettings
{
    public const string SectionName = "ArxivSettings";

    /// <summary>OAI-PMH base URL for arXiv (bulk date-range harvest).</summary>
    [Required(AllowEmptyStrings = false)]
    public string BaseUrl { get; set; } = "http://export.arxiv.org/oai2";

    /// <summary>arXiv Search API base URL (targeted keyword/name search for a single planet).</summary>
    [Required(AllowEmptyStrings = false)]
    public string SearchBaseUrl { get; set; } = "http://export.arxiv.org/api/query";

    /// <summary>Max results returned by a targeted per-planet search.</summary>
    [Range(1, 100)]
    public int TargetedMaxResults { get; set; } = 15;

    /// <summary>OAI-PMH set to harvest (astro-ph.EP = exoplanet papers).</summary>
    [Required(AllowEmptyStrings = false)]
    public string SetSpec { get; set; } = "physics:astro-ph";

    /// <summary>Minimum delay between requests in milliseconds (arXiv requires 3 seconds).</summary>
    [Range(0, 60_000)]
    public int RequestDelayMs { get; set; } = 3000;

    /// <summary>Maximum number of resumption pages to follow per harvest run.</summary>
    [Range(1, 10_000)]
    public int MaxPagesPerRun { get; set; } = 50;

    /// <summary>
    /// Per-request HTTP timeout in seconds. arXiv OAI-PMH can legitimately hold a
    /// connection for a long time while it builds a large result set, so this is well
    /// above the 100s default to avoid spurious cancellations.
    /// </summary>
    [Range(30, 1800)]
    public int HarvestTimeoutSeconds { get; set; } = 300;

    /// <summary>Max times to honour an arXiv flow-control 503 (Retry-After) for one page.</summary>
    [Range(0, 20)]
    public int MaxFlowControlRetries { get; set; } = 5;

    /// <summary>Fallback wait (seconds) when a 503 omits a usable Retry-After header.</summary>
    [Range(1, 300)]
    public int DefaultRetryAfterSeconds { get; set; } = 20;

    /// <summary>
    /// How many days back the first ever harvest reaches. Kept small (a month) because the
    /// broad <c>physics:astro-ph</c> set over a year is hundreds of thousands of records and
    /// makes arXiv apply heavy flow control (slow responses + 503s).
    /// </summary>
    [Range(1, 3650)]
    public int FirstRunLookbackDays { get; set; } = 30;

    /// <summary>
    /// arXiv subcategories to keep. Records whose <c>categories</c> contain none of these are
    /// dropped before upsert, so only exoplanet-relevant papers are stored. An empty list
    /// disables filtering (keep everything).
    /// </summary>
    public List<string> RelevantCategories { get; set; } = new() { "astro-ph.EP" };
}
