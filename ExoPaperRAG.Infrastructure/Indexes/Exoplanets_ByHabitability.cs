using ExoPaperRAG.Domain.Entities;
using Raven.Client.Documents.Indexes;
using System.Linq;

namespace ExoPaperRAG.Infrastructure.Indexes
{
    public class Exoplanets_ByHabitability : AbstractIndexCreationTask<Exoplanet>
    {
        public class Result
        {
            public bool IsPotentiallyHabitable { get; set; }
        }

        public Exoplanets_ByHabitability()
        {
            Map = exoplanets => from planet in exoplanets
                                select new Result
                                {
                                    IsPotentiallyHabitable = planet.StellarEffectiveTemperatureK != null 
                                                          && planet.SemiMajorAxisAu != null
                                                          && planet.SemiMajorAxisAu >= 0.95 
                                                          && planet.SemiMajorAxisAu <= 1.37
                                };
        }
    }
}
