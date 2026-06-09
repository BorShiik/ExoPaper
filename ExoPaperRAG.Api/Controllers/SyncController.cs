using ExoPaperRAG.Application.Features.Sync.Queries;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Quartz;

namespace ExoPaperRAG.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SyncController : ControllerBase
{
    private readonly ISchedulerFactory _schedulerFactory;
    private readonly IMediator _mediator;

    public SyncController(ISchedulerFactory schedulerFactory, IMediator mediator)
    {
        _schedulerFactory = schedulerFactory;
        _mediator = mediator;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken ct)
        => Ok(await _mediator.Send(new GetSyncStatusQuery(), ct));

    [HttpPost("nasa")]
    public async Task<IActionResult> TriggerNasaSync()
    {
        var scheduler = await _schedulerFactory.GetScheduler();
        await scheduler.TriggerJob(new JobKey("NasaSyncJob"));
        return Accepted(new { message = "NASA Sync Job triggered" });
    }

    [HttpPost("arxiv")]
    public async Task<IActionResult> TriggerArxivHarvest()
    {
        var scheduler = await _schedulerFactory.GetScheduler();
        await scheduler.TriggerJob(new JobKey("ArxivHarvesterJob"));
        return Accepted(new { message = "arXiv Harvester Job triggered" });
    }
}
