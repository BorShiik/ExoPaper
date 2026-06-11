using Raven.Client.Documents.Indexes;
using Raven.Client.Documents.Indexes.Vector;
using ExoPaperRAG.Domain.Entities;
using System.Linq;

namespace ExoPaperRAG.Application.Indexes
{
    public class Papers_ByVector : AbstractIndexCreationTask<PaperChunk, Papers_ByVector.Result>
    {
        public class Result
        {
            public string PaperId { get; set; } = string.Empty;
            public string[] ExoplanetIds { get; set; } = System.Array.Empty<string>();
            public int ChunkIndex { get; set; }
            public string Text { get; set; } = string.Empty;
            public object Vector { get; set; } = null!;
        }

        public Papers_ByVector()
        {
            // Index the standalone chunk documents (not the parent Paper) so we never load the
            // large document. ExoplanetIds is pulled via LoadDocument so the planet filter stays
            // correct even when a paper is linked AFTER it was embedded (RavenDB re-indexes the
            // chunk whenever the referenced Paper changes).
            Map = chunks => from chunk in chunks
                            where chunk.Vector != null && chunk.Vector.Length > 0
                            let paper = LoadDocument<Paper>(chunk.PaperId)
                            select new Result
                            {
                                PaperId = chunk.PaperId,
                                ExoplanetIds = paper != null ? paper.ExoplanetIds.ToArray() : System.Array.Empty<string>(),
                                ChunkIndex = chunk.Index,
                                Text = chunk.Text,
                                Vector = CreateVector(chunk.Vector)
                            };

            // Store fields so we can project them out without loading the massive document
            Store(x => x.PaperId, FieldStorage.Yes);
            Store(x => x.ChunkIndex, FieldStorage.Yes);
            Store(x => x.Text, FieldStorage.Yes);

            // Vector search requires the Corax search engine.
            SearchEngineType = Raven.Client.Documents.Indexes.SearchEngineType.Corax;
            
            // Explicitly mark the field as a vector field for Corax
            VectorIndexes.Add(x => x.Vector, new VectorOptions());

            // Ensure ExoplanetIds are not tokenized by the default analyzer
            // so we can filter exactly by "exoplanets/HD-95086-b"
            Index(x => x.ExoplanetIds, FieldIndexing.Exact);
        }
    }
}
