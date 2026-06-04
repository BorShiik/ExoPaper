using ExoPaperRAG.Domain.Entities;
using Raven.Client.Documents.Indexes;
using System.Linq;

namespace ExoPaperRAG.Infrastructure.Indexes
{
    public class Exoplanets_StatsByDiscoveryMethod : AbstractIndexCreationTask<Exoplanet, Exoplanets_StatsByDiscoveryMethod.Result>
    {
        public class Result
        {
            public string DiscoveryMethod { get; set; }
            public int Count { get; set; }
            public double TotalMass { get; set; }
            public double AverageMass { get; set; }
        }

        public Exoplanets_StatsByDiscoveryMethod()
        {
            Map = exoplanets => from planet in exoplanets
                                select new Result
                                {
                                    DiscoveryMethod = planet.DiscoveryMethod ?? "Unknown",
                                    Count = 1,
                                    TotalMass = planet.MassEarth ?? 0,
                                    AverageMass = 0
                                };

            Reduce = results => from result in results
                                group result by result.DiscoveryMethod into g
                                select new Result
                                {
                                    DiscoveryMethod = g.Key,
                                    Count = g.Sum(x => x.Count),
                                    TotalMass = g.Sum(x => x.TotalMass),
                                    AverageMass = g.Sum(x => x.TotalMass) / g.Sum(x => x.Count)
                                };
        }
    }
}
