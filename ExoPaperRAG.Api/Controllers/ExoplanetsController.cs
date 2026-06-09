using ExoPaperRAG.Application.Features.Exoplanets.Commands;
using ExoPaperRAG.Application.Features.Exoplanets.Queries;
using ExoPaperRAG.Application.Features.Planets.Queries;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace ExoPaperRAG.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExoplanetsController : ControllerBase
{
    private readonly IMediator _mediator;

    public ExoplanetsController(IMediator mediator) => _mediator = mediator;

    /// <summary>Request body for the descriptive update endpoint.</summary>
    public record UpdateExoplanetRequest(string Name, string? DiscoveryMethod, double? MassEarth);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateExoplanetCommand command, CancellationToken ct)
    {
        var created = await _mediator.Send(command, ct);
        var slug = created.Id.Split('/').Last();
        return CreatedAtAction(nameof(GetById), new { id = slug }, created);
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? discoveryMethod,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 10,
        [FromQuery] string? sortBy = null,
        CancellationToken ct = default)
        => Ok(await _mediator.Send(new GetExoplanetsQuery(discoveryMethod, skip, take, sortBy), ct));

    [HttpGet("habitable")]
    public async Task<IActionResult> GetHabitable(
        [FromQuery] int skip = 0, [FromQuery] int take = 10, CancellationToken ct = default)
        => Ok(await _mediator.Send(new GetHabitableExoplanetsQuery(skip, take), ct));

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken ct)
        => Ok(await _mediator.Send(new GetDiscoveryStatsQuery(), ct));

    [HttpGet("hwo-count")]
    public async Task<IActionResult> GetHwoCount(CancellationToken ct)
        => Ok(new { count = await _mediator.Send(new GetHwoCandidateCountQuery(), ct) });

    [HttpGet("by-id")]
    public async Task<IActionResult> GetById([FromQuery] string id, CancellationToken ct)
    {
        var planet = await _mediator.Send(new GetExoplanetByIdQuery(id), ct);
        return planet is null ? NotFound() : Ok(planet);
    }

    [HttpPut("{**id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateExoplanetRequest body, CancellationToken ct)
    {
        var updated = await _mediator.Send(
            new UpdateExoplanetCommand(id, body.Name, body.DiscoveryMethod, body.MassEarth), ct);
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{**id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteExoplanetCommand(id), ct);
        return NoContent();
    }

    [HttpGet("uncertainty")]
    public async Task<IActionResult> GetUncertainty(
        [FromQuery] string id, [FromQuery] bool regenerate = false, CancellationToken ct = default)
    {
        var docId = id.StartsWith("exoplanets/", StringComparison.OrdinalIgnoreCase) ? id : $"exoplanets/{id}";
        return Ok(await _mediator.Send(
            new GetUncertaintySummaryQuery { ExoplanetId = docId, Regenerate = regenerate }, ct));
    }
}
