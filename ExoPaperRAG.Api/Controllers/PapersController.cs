using ExoPaperRAG.Application.Features.Papers.Commands;
using ExoPaperRAG.Application.Features.Papers.Queries;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace ExoPaperRAG.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PapersController : ControllerBase
{
    private readonly IMediator _mediator;

    public PapersController(IMediator mediator) => _mediator = mediator;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePaperCommand command, CancellationToken ct)
    {
        var created = await _mediator.Send(command, ct);
        return Ok(created);
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string? query, [FromQuery] int skip = 0, [FromQuery] int take = 10, CancellationToken ct = default)
        => Ok(await _mediator.Send(new SearchPapersQuery(query, skip, take), ct));

    [HttpGet("by-exoplanet")]
    public async Task<IActionResult> GetByExoplanet(
        [FromQuery] string exoplanetId, [FromQuery] int skip = 0, [FromQuery] int take = 10, CancellationToken ct = default)
        => Ok(await _mediator.Send(new GetPapersByExoplanetQuery(exoplanetId, skip, take), ct));

    [HttpGet("with-authors")]
    public async Task<IActionResult> GetWithAuthors([FromQuery] string id, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetPaperWithAuthorsQuery(id), ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("similar")]
    public async Task<IActionResult> FindSimilar(
        [FromBody] float[] queryVector, [FromQuery] int take = 5, CancellationToken ct = default)
        => Ok(await _mediator.Send(new FindSimilarPapersQuery(queryVector, take), ct));

    [HttpPost("mark-reviewed")]
    public async Task<IActionResult> MarkAllAsReviewed(CancellationToken ct)
    {
        await _mediator.Send(new MarkAllPapersReviewedCommand(), ct);
        return Ok(new { Message = "Mass update completed via PatchByQuery." });
    }

    [HttpPost("hybrid-search")]
    public async Task<IActionResult> HybridSearch(
        [FromBody] ExoPaperRAG.Application.Features.Papers.Queries.SearchHybridQuery query, CancellationToken ct)
        => Ok(await _mediator.Send(query, ct));
}
