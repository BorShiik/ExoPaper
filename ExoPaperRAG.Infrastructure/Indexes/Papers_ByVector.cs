using Raven.Client.Documents.Indexes;
using ExoPaperRAG.Domain.Entities;
using System.Linq;

namespace ExoPaperRAG.Infrastructure.Indexes
{
    public class Papers_ByVector : AbstractIndexCreationTask<Paper>
    {
        public Papers_ByVector()
        {
            Map = papers => from paper in papers
                            select new
                            {
                                Vector = CreateVector(paper.Vector)
                            };

            // КРИТИЧНО: Векторный поиск работает только с Corax
            SearchEngineType = Raven.Client.Documents.Indexes.SearchEngineType.Corax;
        }
    }
}
