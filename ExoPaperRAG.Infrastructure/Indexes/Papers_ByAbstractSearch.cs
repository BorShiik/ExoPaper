using ExoPaperRAG.Domain.Entities;
using Raven.Client.Documents.Indexes;
using System.Linq;

namespace ExoPaperRAG.Infrastructure.Indexes
{
    public class Papers_ByAbstractSearch : AbstractIndexCreationTask<Paper>
    {
        public Papers_ByAbstractSearch()
        {
            Map = papers => from paper in papers
                            select new
                            {
                                Abstract = paper.Abstract
                            };

            Index(x => x.Abstract, FieldIndexing.Search);
        }
    }
}
