namespace ExoPaperRAG.Application.Abstractions;

/// <summary>
/// On-demand harvest of arXiv papers for a single planet (by name and aliases), linking the
/// results directly to it. Used to fill the literature gap for sparsely-studied planets when
/// the user opens a planet that has no associated publications yet.
/// </summary>
public interface ITargetedPaperHarvester
{
    /// <summary>
    /// Searches arXiv for the planet and links matching papers to it.
    /// Returns the number of papers newly linked to this planet.
    /// </summary>
    Task<int> HarvestForPlanetAsync(string exoplanetDocId, CancellationToken ct = default);
}
