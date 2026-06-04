using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;
using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Infrastructure.Indexes;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;

namespace ExoPaperRAG.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ExoplanetsController : ControllerBase
    {
        private readonly IDocumentStore _store;

        public ExoplanetsController(IDocumentStore store)
        {
            _store = store;
        }

        // CRUD: Create
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Exoplanet planet)
        {
            using var session = _store.OpenAsyncSession();
            await session.StoreAsync(planet);
            await session.SaveChangesAsync();
            return Ok(planet);
        }

        // CRUD: Read & Dynamic Queries & Paging & Sorting
        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] string? discoveryMethod, [FromQuery] int skip = 0, [FromQuery] int take = 10, [FromQuery] string? sortBy = null)
        {
            using var session = _store.OpenAsyncSession();
            var query = session.Query<Exoplanet>();

            if (!string.IsNullOrEmpty(discoveryMethod))
            {
                // Dynamic query using Auto-Indexes
                query = query.Where(p => p.DiscoveryMethod == discoveryMethod);
            }

            if (sortBy == "orbitalPeriod")
            {
                query = query.OrderBy(p => p.OrbitalPeriodDays);
            }

            var results = await query.Skip(skip).Take(take).ToListAsync();
            return Ok(results);
        }

        // CRUD: Update
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Exoplanet updatedPlanet)
        {
            using var session = _store.OpenAsyncSession();
            var planet = await session.LoadAsync<Exoplanet>($"exoplanets/{id}");
            if (planet == null) return NotFound();

            planet.Name = updatedPlanet.Name;
            planet.DiscoveryMethod = updatedPlanet.DiscoveryMethod;
            planet.MassEarth = updatedPlanet.MassEarth;
            
            await session.SaveChangesAsync();
            return NoContent();
        }

        // CRUD: Delete
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            using var session = _store.OpenAsyncSession();
            session.Delete($"exoplanets/{id}");
            await session.SaveChangesAsync();
            return NoContent();
        }

        // Static Index Query with Computed Fields
        [HttpGet("habitable")]
        public async Task<IActionResult> GetHabitable([FromQuery] int skip = 0, [FromQuery] int take = 10)
        {
            using var session = _store.OpenAsyncSession();
            var results = await session.Query<Exoplanets_ByHabitability.Result, Exoplanets_ByHabitability>()
                .Where(x => x.IsPotentiallyHabitable)
                .OfType<Exoplanet>()
                .Skip(skip)
                .Take(take)
                .ToListAsync();

            return Ok(results);
        }

        // Map-Reduce Index Query
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            using var session = _store.OpenAsyncSession();
            var results = await session.Query<Exoplanets_StatsByDiscoveryMethod.Result, Exoplanets_StatsByDiscoveryMethod>()
                .ToListAsync();

            return Ok(results);
        }
    }
}
