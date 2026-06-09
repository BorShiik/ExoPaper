using ExoPaperRAG.Application.Features.Authors;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace ExoPaperRAG.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthorsController : ControllerBase
{
    private readonly IMediator _mediator;

    public AuthorsController(IMediator mediator) => _mediator = mediator;

    public record CreateAuthorRequest(string Name, string Affiliation = "", string? Id = null);
    public record UpdateAuthorRequest(string Name, string Affiliation = "");

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct)
    {
        var author = await _mediator.Send(new GetAuthorByIdQuery(id), ct);
        return author is null ? NotFound() : Ok(author);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAuthorRequest body, CancellationToken ct)
    {
        var created = await _mediator.Send(new CreateAuthorCommand(body.Name, body.Affiliation, body.Id), ct);
        var slug = created.Id.Split('/').Last();
        return CreatedAtAction(nameof(Get), new { id = slug }, created);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateAuthorRequest body, CancellationToken ct)
    {
        var updated = await _mediator.Send(new UpdateAuthorCommand(id, body.Name, body.Affiliation), ct);
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteAuthorCommand(id), ct);
        return NoContent();
    }
}
