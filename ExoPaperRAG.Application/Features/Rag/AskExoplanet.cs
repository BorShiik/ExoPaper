using System.Runtime.CompilerServices;
using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Application.Common;
using ExoPaperRAG.Domain.Entities;
using MediatR;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;
using Raven.Client.Documents.Session;
using ExoPaperRAG.Application.Indexes;

namespace ExoPaperRAG.Application.Features.Rag;

/// <summary>
/// Conversational RAG: retrieves the most relevant paper chunks (vector search) for the
/// question, optionally grounds them in a focused planet, and streams an LLM answer
/// token-by-token with inline citations. Implemented as a MediatR stream request so
/// the API/SignalR layer stays transport-only.
/// </summary>
public record AskExoplanetQuery : IStreamRequest<AskChunk>
{
    public string Question { get; init; } = string.Empty;
    /// <summary>Optional planet to ground the answer (full or short id).</summary>
    public string? ExoplanetId { get; init; }
    public int Take { get; init; } = 6;
}

public record AskSource
{
    public string PaperId { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
}

/// <summary>A single streamed event: "sources" (once), many "token", then "done".</summary>
public record AskChunk
{
    public string Type { get; init; } = "token";
    public string? Content { get; init; }
    public IReadOnlyList<AskSource>? Sources { get; init; }
}

public class AskExoplanetQueryHandler : IStreamRequestHandler<AskExoplanetQuery, AskChunk>
{
    private readonly IDocumentStore _store;
    private readonly IOllamaClient _ollama;

    public AskExoplanetQueryHandler(IDocumentStore store, IOllamaClient ollama)
    {
        _store = store;
        _ollama = ollama;
    }

    public async IAsyncEnumerable<AskChunk> Handle(
        AskExoplanetQuery request, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Question))
        {
            yield return new AskChunk { Type = "done" };
            yield break;
        }

        var take = Math.Clamp(request.Take, 1, 12);
        var queryVector = await _ollama.GetEmbeddingAsync(request.Question, cancellationToken);

        using var session = _store.OpenAsyncSession();

        // Resolve the focused planet first so retrieval can be grounded in it.
        Exoplanet? planet = null;
        string? planetDocId = null;
        if (!string.IsNullOrWhiteSpace(request.ExoplanetId))
        {
            planetDocId = RavenIds.EnsurePrefix(request.ExoplanetId, "exoplanets/");
            planet = await session.LoadAsync<Exoplanet>(planetDocId, cancellationToken);
        }

        var chunks = await VectorSearchAsync(session, queryVector, planetDocId, take, cancellationToken);

        // Fallback: the planet has no embedded+linked papers yet. Rather than answering
        // from corpus-wide noise, retry unscoped only when no planet was in focus.
        if (chunks.Count == 0 && planetDocId is null)
            chunks = await VectorSearchAsync(session, queryVector, null, take, cancellationToken);

        if (chunks.Count == 0)
        {
            yield return new AskChunk
            {
                Type = "token",
                Content = planetDocId is not null
                    ? "No embedded publications are linked to this planet yet. Once the linking " +
                      "and embedding workers have processed its papers, ask again."
                    : "No vectorized publications match this question yet. " +
                      "Harvest more papers (arXiv) and let them embed, then try again."
            };
            yield return new AskChunk { Type = "done" };
            yield break;
        }

        // Load parent papers for titles
        var paperIds = chunks.Select(c => c.PaperId).Distinct().ToList();
        var papers = await session.LoadAsync<Paper>(paperIds, cancellationToken);

        // 1) Emit the sources used for grounding.
        yield return new AskChunk
        {
            Type = "sources",
            Sources = papers.Values.Where(p => p != null).Select(p => new AskSource { PaperId = p.Id, Title = p.Title }).ToList()
        };

        // 2) Build a grounded prompt from chunk text instead of just abstracts
        var context = string.Join("\n\n", chunks.Select((c, i) =>
        {
            var p = papers.TryGetValue(c.PaperId, out var paper) ? paper : null;
            var title = p?.Title ?? "Unknown Source";
            return $"[{i + 1}] {title} (Chunk {c.ChunkIndex})\n{Truncate(c.Text, 1200)}";
        }));

        var planetBlock = planet is null
            ? string.Empty
            : $"Planet in focus: {planet.Name} (method: {planet.DiscoveryMethod ?? "N/A"}, " +
              $"mass: {planet.MassEarth?.ToString("F2") ?? "N/A"} M_earth, " +
              $"radius: {planet.RadiusEarth?.ToString("F2") ?? "N/A"} R_earth).\n\n";

        const string system =
            "You are an exoplanet research assistant. Answer the question using ONLY the numbered " +
            "sources provided. Cite sources inline as [n]. If the sources do not contain the answer, " +
            "say so explicitly. Be concise, factual and scientific.";

        var userPrompt = $"{planetBlock}=== SOURCES ===\n{context}\n\n=== QUESTION ===\n{request.Question}";

        // 3) Stream the answer token-by-token.
        await foreach (var token in _ollama.GenerateStreamAsync(userPrompt, system, cancellationToken))
            yield return new AskChunk { Type = "token", Content = token };

        yield return new AskChunk { Type = "done" };
    }

    /// <summary>
    /// Vector similarity search over <c>Papers/ByVector</c>, optionally constrained to a
    /// single planet via the indexed ExoplanetIds field.
    /// </summary>
    private static async Task<List<Papers_ByVector.Result>> VectorSearchAsync(
        IAsyncDocumentSession session,
        float[] queryVector,
        string? planetDocId,
        int take,
        CancellationToken ct)
    {
        var queryable = session.Query<Papers_ByVector.Result, Papers_ByVector>();

        // AND the planet filter with the vector search so only linked papers are ranked.
        if (!string.IsNullOrWhiteSpace(planetDocId))
            queryable = queryable.Where(x => x.ExoplanetIds.Contains(planetDocId));

        return await queryable
            .VectorSearch(
                indexField => indexField.WithField(x => x.Vector),
                factory => factory.ByEmbedding(queryVector))
            .Take(take)
            .ProjectInto<Papers_ByVector.Result>()
            .ToListAsync(ct);
    }

    private static string Truncate(string? text, int max)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        return text.Length <= max ? text : text[..max] + "…";
    }
}
