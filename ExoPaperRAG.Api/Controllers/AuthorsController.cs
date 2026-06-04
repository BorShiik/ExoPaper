using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents;
using ExoPaperRAG.Domain.Entities;
using System.Threading.Tasks;

namespace ExoPaperRAG.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthorsController : ControllerBase
    {
        private readonly IDocumentStore _store;

        public AuthorsController(IDocumentStore store)
        {
            _store = store;
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(string id)
        {
            using var session = _store.OpenAsyncSession();
            var author = await session.LoadAsync<Author>($"authors/{id}");
            if (author == null) return NotFound();
            return Ok(author);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Author author)
        {
            using var session = _store.OpenAsyncSession();
            await session.StoreAsync(author);
            await session.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = author.Id?.Split('/')[1] }, author);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Author updatedAuthor)
        {
            using var session = _store.OpenAsyncSession();
            var author = await session.LoadAsync<Author>($"authors/{id}");
            if (author == null) return NotFound();

            author.Name = updatedAuthor.Name;
            author.Affiliation = updatedAuthor.Affiliation;

            await session.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            using var session = _store.OpenAsyncSession();
            session.Delete($"authors/{id}");
            await session.SaveChangesAsync();
            return NoContent();
        }
    }
}
