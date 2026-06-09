using System.ComponentModel.DataAnnotations;

namespace ExoPaperRAG.Infrastructure.Settings;

public class ArxivSettings
{
    public const string SectionName = "ArxivSettings";

    /// <summary>OAI-PMH base URL for arXiv.</summary>
    [Required(AllowEmptyStrings = false)]
    public string BaseUrl { get; set; } = "http://export.arxiv.org/oai2";

    /// <summary>OAI-PMH set to harvest (astro-ph.EP = exoplanet papers).</summary>
    [Required(AllowEmptyStrings = false)]
    public string SetSpec { get; set; } = "physics:astro-ph";

    /// <summary>Minimum delay between requests in milliseconds (arXiv requires 3 seconds).</summary>
    [Range(0, 60_000)]
    public int RequestDelayMs { get; set; } = 3000;

    /// <summary>Maximum number of resumption pages to follow per harvest run.</summary>
    [Range(1, 10_000)]
    public int MaxPagesPerRun { get; set; } = 50;
}
