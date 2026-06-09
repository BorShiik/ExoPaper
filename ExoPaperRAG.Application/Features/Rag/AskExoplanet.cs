using System.Runtime.CompilerServices;
using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Application.Common;
using ExoPaperRAG.Domain.Entities;
using MediatR;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;

namespace ExoPaperRAG.Application.Features.Rag;

/// <summary>
/// Conversational RAG: retrieves the most relevant papers (vector search) for the
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

        var papers = await session.Advanced
            .AsyncDocumentQuery<Paper>("Papers/ByVector")
            .VectorSearch(
                fieldName => fieldName.WithEmbedding(
                    "Vector", Raven.Client.Documents.Indexes.Vector.VectorEmbeddingType.Single),
                factory => factory.ByEmbedding(queryVector))
            .Take(take)
            .ToListAsync(cancellationToken);

        Exoplanet? planet = null;
        if (!string.IsNullOrWhiteSpace(request.ExoplanetId))
            planet = await session.LoadAsync<Exoplanet>(
                RavenIds.EnsurePrefix(request.ExoplanetId, "exoplanets/"), cancellationToken);

        // 1) Emit the sources used for grounding.
        yield return new AskChunk
        {
            Type = "sources",
            Sources = papers.Select(p => new AskSource { PaperId = p.Id, Title = p.Title }).ToList()
        };

        if (papers.Count == 0)
        {
            yield return new AskChunk
            {
                Type = "token",
                Content = "No vectorized publications match this question yet. " +
                          "Harvest more papers (arXiv) and let them embed, then try again."
            };
            yield return new AskChunk { Type = "done" };
            yield break;
        }

        // 2) Build a grounded prompt.
        var context = string.Join("\n\n", papers.Select((p, i) =>
            $"[{i + 1}] {p.Title}\n{Truncate(p.Abstract, 800)}"));

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

    private static string Truncate(string? text, int max)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        return text.Length <= max ? text : text[..max] + "…";
    }
}
