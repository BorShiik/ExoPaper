using System.Text;
using ExoPaperRAG.Domain.Entities;
using Microsoft.Extensions.Logging;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;

namespace ExoPaperRAG.Infrastructure.Services;

/// <summary>
/// In-memory gazetteer of exoplanet names used for dictionary-based entity linking.
/// Names and text are normalized (lower-cased, stripped of spaces/hyphens/punctuation)
/// so that "Kepler-22 b", "Kepler-22b" and "Kepler 22 b" all collapse to one key —
/// dramatically improving recall against free-form arXiv abstracts.
///
/// Loaded by streaming the whole Exoplanet collection and refreshed on a TTL, so new
/// planets from NASA sync become linkable without a restart. Thread-safe.
/// </summary>
public sealed class ExoplanetGazetteer
{
    private readonly IDocumentStore _store;
    private readonly ILogger<ExoplanetGazetteer> _logger;
    private readonly SemaphoreSlim _gate = new(1, 1);

    private (string Key, string Id)[] _entries = Array.Empty<(string, string)>();
    private DateTime _loadedAtUtc = DateTime.MinValue;

    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(30);
    private const int MinKeyLength = 5;   // drop ambiguous short names (e.g. "K2-3 d")
    private const int MaxMatchesPerPaper = 50;

    public ExoplanetGazetteer(IDocumentStore store, ILogger<ExoplanetGazetteer> logger)
    {
        _store = store;
        _logger = logger;
    }

    public int Count => _entries.Length;

    /// <summary>Loads the gazetteer if empty or older than the TTL.</summary>
    public async Task EnsureLoadedAsync(CancellationToken ct, bool force = false)
    {
        if (!force && _entries.Length > 0 && DateTime.UtcNow - _loadedAtUtc < Ttl)
            return;

        await _gate.WaitAsync(ct);
        try
        {
            if (!force && _entries.Length > 0 && DateTime.UtcNow - _loadedAtUtc < Ttl)
                return;

            var list = new List<(string, string)>();
            using var session = _store.OpenAsyncSession();
            await using var stream = await session.Advanced.StreamAsync(session.Query<Exoplanet>(), ct);
            while (await stream.MoveNextAsync())
            {
                var e = stream.Current.Document;
                if (string.IsNullOrWhiteSpace(e.Name) || string.IsNullOrWhiteSpace(e.Id))
                    continue;

                var key = Normalize(e.Name);
                if (key.Length >= MinKeyLength)
                    list.Add((key, e.Id));
            }

            _entries = list.ToArray();
            _loadedAtUtc = DateTime.UtcNow;
            _logger.LogInformation("[Gazetteer] Loaded {Count} exoplanet names.", _entries.Length);
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Returns the ids of exoplanets whose (normalized) name appears in the text.</summary>
    public IReadOnlyCollection<string> Match(string? title, string? abstractText)
    {
        var entries = _entries; // snapshot (reference read is atomic)
        if (entries.Length == 0)
            return Array.Empty<string>();

        var norm = Normalize($"{title} {abstractText}");
        if (norm.Length == 0)
            return Array.Empty<string>();

        var found = new HashSet<string>();
        foreach (var (key, id) in entries)
        {
            if (norm.Contains(key, StringComparison.Ordinal))
            {
                found.Add(id);
                if (found.Count >= MaxMatchesPerPaper)
                    break;
            }
        }
        return found;
    }

    private static string Normalize(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s)
            if (char.IsLetterOrDigit(ch))
                sb.Append(char.ToLowerInvariant(ch));
        return sb.ToString();
    }
}
