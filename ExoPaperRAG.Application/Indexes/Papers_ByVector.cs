using Raven.Client.Documents.Indexes;
using ExoPaperRAG.Domain.Entities;
using System.Linq;

namespace ExoPaperRAG.Application.Indexes
{
    public class Papers_ByVector : AbstractIndexCreationTask<Paper>
    {
        public Papers_ByVector()
        {
            Map = papers => from paper in papers
                            // Only index papers the EmbeddingWorker has already vectorized.
                            // Newly harvested papers have HasEmbeddings == false and an empty
                            // (default Array.Empty<float>()) Vector; feeding those to
                            // CreateVector throws inside Corax and errors the index.
                            // Note: Vector is never actually null (defaults to an empty array),
                            // so the Length guard is the one that actually filters unembedded docs.
                            where paper.HasEmbeddings == true
                                  && paper.Vector != null
                                  && paper.Vector.Length > 0
                            select new
                            {
                                // Indexed so RAG retrieval can scope the vector search to a
                                // specific planet (Paper.ExoplanetIds contains the planet doc id).
                                paper.ExoplanetIds,
                                Vector = CreateVector(paper.Vector)
                            };

            // Vector search requires the Corax search engine.
            SearchEngineType = Raven.Client.Documents.Indexes.SearchEngineType.Corax;
        }
    }
}
