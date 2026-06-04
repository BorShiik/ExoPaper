using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents;
using Raven.Client.Documents.Linq;
using Raven.Client.Documents.Operations;
using Raven.Client.Documents.Queries;
using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Infrastructure.Indexes;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using System;
using MediatR;
using ExoPaperRAG.Application.Features.Papers.Queries;

namespace ExoPaperRAG.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PapersController : ControllerBase
    {
        private readonly IDocumentStore _store;
        private readonly IMediator _mediator;

        public PapersController(IDocumentStore store, IMediator mediator)
        {
            _store = store;
            _mediator = mediator;
        }

        // CRUD: Create
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Paper paper)
        {
            using var session = _store.OpenAsyncSession();
            await session.StoreAsync(paper);
            await session.SaveChangesAsync();
            return Ok(paper);
        }

        // Full Text Search Requirement
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string query, [FromQuery] int skip = 0, [FromQuery] int take = 10)
        {
            using var session = _store.OpenAsyncSession();
            var results = await session.Query<Paper, Papers_ByAbstractSearch>()
                .Search(x => x.Abstract, query)
                .Skip(skip)
                .Take(take)
                .ToListAsync();

            return Ok(results);
        }

        // Related Documents (Include) Requirement
        [HttpGet("{id}/with-authors")]
        public async Task<IActionResult> GetWithAuthors(string id)
        {
            using var session = _store.OpenAsyncSession();
            
            // Includes Authors to avoid N+1 queries
            var paper = await session.LoadAsync<Paper>(
                $"papers/{id}",
                includes => includes.IncludeDocuments(x => x.AuthorIds)
            );

            if (paper == null) return NotFound();

            var authors = new List<Author>();
            foreach(var authorId in paper.AuthorIds)
            {
                authors.Add(await session.LoadAsync<Author>(authorId)); // This does not trigger an extra DB call!
            }

            return Ok(new { Paper = paper, Authors = authors });
        }

        // Vector Search Requirement
        [HttpPost("similar")]
        public async Task<IActionResult> FindSimilar([FromBody] float[] queryVector, [FromQuery] int take = 5)
        {
            using var session = _store.OpenAsyncSession();
            var results = await session.Query<Paper, Papers_ByVector>()
                .VectorSearch(
                    indexField => indexField.WithField(x => x.Vector), 
                    factory => factory.ByEmbedding(queryVector) 
                )
                .Take(take)
                .ToListAsync();

            return Ok(results);
        }

        // PatchByQuery Requirement
        [HttpPost("mark-reviewed")]
        public IActionResult MarkAllAsReviewed()
        {
            var operation = _store.Operations.Send(new PatchByQueryOperation(new IndexQuery
            {
                Query = @"from Papers update { this.IsReviewed = true; }"
            }));

            operation.WaitForCompletion(TimeSpan.FromSeconds(15));
            
            return Ok(new { Message = "Mass update initiated via PatchByQuery" });
        }

        // Hybrid Search (Vector + Metadata Filter)
        [HttpPost("hybrid-search")]
        public async Task<IActionResult> HybridSearch([FromBody] SearchHybridQuery query, CancellationToken ct)
        {
            var results = await _mediator.Send(query, ct);
            return Ok(results);
        }
    }
}
