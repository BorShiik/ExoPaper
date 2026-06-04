using MediatR;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;
using ExoPaperRAG.Application.Abstractions;
using ExoPaperRAG.Domain.Entities;

namespace ExoPaperRAG.Application.Features.Papers.Queries;

/// <summary>
/// Handler for hybrid search: 
/// 1. Converts user query text → embedding vector via Ollama.
/// 2. Optionally filters linked exoplanets by hard criteria.
/// 3. Performs vector search (cosine similarity) on Papers_ByVector index.
/// </summary>
public class SearchHybridQueryHandler : IRequestHandler<SearchHybridQuery, SearchHybridResult>
{
    private readonly IDocumentStore _store;
    private readonly IOllamaClient _ollama;

    public SearchHybridQueryHandler(IDocumentStore store, IOllamaClient ollama)
    {
        _store = store;
        _ollama = ollama;
    }

    public async Task<SearchHybridResult> Handle(SearchHybridQuery request, CancellationToken ct)
    {
        // Step 1: Convert user's natural language query to a vector
        var queryVector = await _ollama.GetEmbeddingAsync(request.SearchText, ct);

        using var session = _store.OpenAsyncSession();

        // Step 2: If hard filters are specified, find matching exoplanet IDs first
        HashSet<string>? allowedExoplanetIds = null;

        if (request.MaxMassEarth.HasValue || !string.IsNullOrEmpty(request.DiscoveryMethod))
        {
            var planetQuery = session.Query<Exoplanet>();

            if (request.MaxMassEarth.HasValue)
                planetQuery = planetQuery.Where(p => p.MassEarth != null && p.MassEarth <= request.MaxMassEarth.Value);

            if (!string.IsNullOrEmpty(request.DiscoveryMethod))
                planetQuery = planetQuery.Where(p => p.DiscoveryMethod == request.DiscoveryMethod);

            var filteredPlanets = await planetQuery
                .Select(p => p.Id)
                .Take(1024) // reasonable cap
                .ToListAsync(ct);

            allowedExoplanetIds = new HashSet<string>(filteredPlanets);
        }

        // Step 3: Vector search on Papers_ByVector (Corax) index
        var vectorResults = await session
            .Advanced.AsyncDocumentQuery<Paper>("Papers/ByVector")
            .VectorSearch(
                fieldName => fieldName.WithEmbedding("Vector", Raven.Client.Documents.Indexes.Vector.VectorEmbeddingType.Single),
                factory => factory.ByEmbedding(queryVector))
            .Take(request.Take * 2) // fetch more to allow post-filtering
            .ToListAsync(ct);

        // Step 4: Post-filter by exoplanet IDs if hard filters were applied
        IEnumerable<Paper> filtered = vectorResults;

        if (allowedExoplanetIds != null)
        {
            filtered = vectorResults.Where(p =>
                p.ExoplanetIds.Any(id => allowedExoplanetIds.Contains(id)));
        }

        var results = filtered.Take(request.Take).Select(p => new PaperSearchHit
        {
            Id = p.Id,
            Title = p.Title,
            Abstract = p.Abstract,
            PublishedDate = p.PublishedDate,
            ExoplanetIds = p.ExoplanetIds
        }).ToList();

        return new SearchHybridResult { Papers = results };
    }
}
