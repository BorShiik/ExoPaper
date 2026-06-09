using System.Net;
using System.Xml.Linq;
using ExoPaperRAG.Infrastructure.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ExoPaperRAG.Infrastructure.Services;

/// <summary>
/// DTO representing a single arXiv record parsed from OAI-PMH XML.
/// </summary>
public class ArxivRecord
{
    public string ArxivId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Abstract { get; set; } = string.Empty;
    public DateTime Created { get; set; }
    public List<string> Authors { get; set; } = new();
    public List<string> Categories { get; set; } = new();
}

/// <summary>
/// Result of a single OAI-PMH ListRecords call.
/// </summary>
public class ArxivHarvestPage
{
    public List<ArxivRecord> Records { get; set; } = new();
    public string? ResumptionToken { get; set; }
}

public interface IArxivClient
{
    /// <summary>
    /// Fetches the first page of records from arXiv OAI-PMH, optionally filtered by date.
    /// </summary>
    Task<ArxivHarvestPage> ListRecordsAsync(DateTime? from = null, CancellationToken ct = default);

    /// <summary>
    /// Fetches the next page using a resumption token.
    /// </summary>
    Task<ArxivHarvestPage> ListRecordsAsync(string resumptionToken, CancellationToken ct = default);
}

public class ArxivClient : IArxivClient
{
    private readonly HttpClient _httpClient;
    private readonly ArxivSettings _settings;
    private readonly ILogger<ArxivClient> _logger;

    // CRITICAL: arXiv requires a minimum 3-second gap between requests.
    // A SemaphoreSlim ensures that even if multiple threads call us, only one request is in-flight.
    private static readonly SemaphoreSlim _rateLimiter = new(1, 1);

    private static readonly XNamespace OaiNs = "http://www.openarchives.org/OAI/2.0/";
    private static readonly XNamespace ArxivNs = "http://arxiv.org/OAI/arXiv/";
    private static readonly XNamespace DcNs = "http://purl.org/dc/elements/1.1/";
    private static readonly XNamespace OaiDcNs = "http://www.openarchives.org/OAI/2.0/oai_dc/";

    public ArxivClient(HttpClient httpClient, IOptions<ArxivSettings> options, ILogger<ArxivClient> logger)
    {
        _httpClient = httpClient;
        _settings = options.Value;
        _logger = logger;
    }

    public async Task<ArxivHarvestPage> ListRecordsAsync(DateTime? from = null, CancellationToken ct = default)
    {
        var url = $"{_settings.BaseUrl}?verb=ListRecords&metadataPrefix=arXiv&set={_settings.SetSpec}";
        if (from.HasValue)
        {
            url += $"&from={from.Value:yyyy-MM-dd}";
        }

        return await FetchAndParseAsync(url, ct);
    }

    public async Task<ArxivHarvestPage> ListRecordsAsync(string resumptionToken, CancellationToken ct = default)
    {
        var url = $"{_settings.BaseUrl}?verb=ListRecords&resumptionToken={Uri.EscapeDataString(resumptionToken)}";
        return await FetchAndParseAsync(url, ct);
    }

    private async Task<ArxivHarvestPage> FetchAndParseAsync(string url, CancellationToken ct)
    {
        await _rateLimiter.WaitAsync(ct);
        try
        {
            // Enforce minimum delay between requests
            await Task.Delay(_settings.RequestDelayMs, ct);

            _logger.LogInformation("[arXiv] Fetching: {Url}", url);
            var xml = await GetWithFlowControlAsync(url, ct);
            var doc = XDocument.Parse(xml);

            // Early return: check for OAI-PMH error element
            var errorElement = doc.Root?.Element(OaiNs + "error");
            if (errorElement != null)
            {
                var errorCode = errorElement.Attribute("code")?.Value ?? "unknown";
                var errorMessage = errorElement.Value;
                _logger.LogWarning("[arXiv] OAI-PMH error: {Code} - {Message}", errorCode, errorMessage);

                // "noRecordsMatch" is not a fatal error — it simply means no new records
                if (errorCode == "noRecordsMatch")
                {
                    return new ArxivHarvestPage();
                }

                throw new InvalidOperationException($"arXiv OAI-PMH error [{errorCode}]: {errorMessage}");
            }

            return ParseListRecords(doc);
        }
        finally
        {
            _rateLimiter.Release();
        }
    }

    /// <summary>
    /// Performs the OAI-PMH GET, honouring arXiv's flow control: a <c>503 Service Unavailable</c>
    /// with a <c>Retry-After</c> header means "wait, then re-issue the same request". We respect
    /// that header (Polly's generic transient retry would back off far too aggressively and ignore
    /// the server-specified delay) and only give up after <see cref="ArxivSettings.MaxFlowControlRetries"/>.
    /// </summary>
    private async Task<string> GetWithFlowControlAsync(string url, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            var response = await _httpClient.GetAsync(url, ct);

            if (response.StatusCode == HttpStatusCode.ServiceUnavailable &&
                attempt < _settings.MaxFlowControlRetries)
            {
                var wait = GetRetryAfter(response)
                    ?? TimeSpan.FromSeconds(_settings.DefaultRetryAfterSeconds);

                _logger.LogInformation(
                    "[arXiv] Flow control (503). Waiting {Seconds}s before retry {Attempt}/{Max}.",
                    wait.TotalSeconds, attempt + 1, _settings.MaxFlowControlRetries);

                await Task.Delay(wait, ct);
                continue;
            }

            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync(ct);
        }
    }

    /// <summary>Reads a <c>Retry-After</c> header expressed either as a delay or an absolute date.</summary>
    private static TimeSpan? GetRetryAfter(HttpResponseMessage response)
    {
        var retryAfter = response.Headers.RetryAfter;
        if (retryAfter is null) return null;

        if (retryAfter.Delta is { } delta && delta > TimeSpan.Zero)
            return delta;

        if (retryAfter.Date is { } date)
        {
            var fromNow = date - DateTimeOffset.UtcNow;
            if (fromNow > TimeSpan.Zero) return fromNow;
        }

        return null;
    }

    private ArxivHarvestPage ParseListRecords(XDocument doc)
    {
        var result = new ArxivHarvestPage();

        var listRecords = doc.Root?.Element(OaiNs + "ListRecords");
        if (listRecords == null)
        {
            _logger.LogWarning("[arXiv] No ListRecords element found in response.");
            return result;
        }

        foreach (var record in listRecords.Elements(OaiNs + "record"))
        {
            var header = record.Element(OaiNs + "header");
            var metadata = record.Element(OaiNs + "metadata");

            // Skip deleted records
            if (header?.Attribute("status")?.Value == "deleted")
                continue;

            if (metadata == null)
                continue;

            var arxivMeta = metadata.Element(ArxivNs + "arXiv");
            if (arxivMeta == null)
                continue;

            try
            {
                var arxivRecord = new ArxivRecord
                {
                    ArxivId = arxivMeta.Element(ArxivNs + "id")?.Value?.Trim() ?? string.Empty,
                    Title = CleanText(arxivMeta.Element(ArxivNs + "title")?.Value),
                    Abstract = CleanText(arxivMeta.Element(ArxivNs + "abstract")?.Value),
                    Created = DateTime.TryParse(arxivMeta.Element(ArxivNs + "created")?.Value, out var dt)
                        ? dt
                        : DateTime.MinValue,
                };

                // Parse authors
                var authorsElement = arxivMeta.Element(ArxivNs + "authors");
                if (authorsElement != null)
                {
                    foreach (var author in authorsElement.Elements(ArxivNs + "author"))
                    {
                        var forenames = author.Element(ArxivNs + "forenames")?.Value ?? "";
                        var keyname = author.Element(ArxivNs + "keyname")?.Value ?? "";
                        var fullName = $"{forenames} {keyname}".Trim();
                        if (!string.IsNullOrEmpty(fullName))
                            arxivRecord.Authors.Add(fullName);
                    }
                }

                // Parse categories
                var categories = arxivMeta.Element(ArxivNs + "categories")?.Value;
                if (!string.IsNullOrEmpty(categories))
                {
                    arxivRecord.Categories = categories.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
                }

                if (!string.IsNullOrEmpty(arxivRecord.ArxivId))
                {
                    result.Records.Add(arxivRecord);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[arXiv] Failed to parse record, skipping.");
            }
        }

        // Extract resumption token
        var tokenElement = listRecords.Element(OaiNs + "resumptionToken");
        var token = tokenElement?.Value?.Trim();
        result.ResumptionToken = string.IsNullOrEmpty(token) ? null : token;

        _logger.LogInformation("[arXiv] Parsed {Count} records. ResumptionToken: {Token}",
            result.Records.Count,
            result.ResumptionToken != null ? "present" : "none");

        return result;
    }

    /// <summary>
    /// Cleans whitespace artifacts from arXiv text (LaTeX newlines, excessive spaces).
    /// </summary>
    private static string CleanText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        // Collapse multi-line LaTeX formatting into single spaces
        return System.Text.RegularExpressions.Regex
            .Replace(text.Trim(), @"\s+", " ");
    }
}
