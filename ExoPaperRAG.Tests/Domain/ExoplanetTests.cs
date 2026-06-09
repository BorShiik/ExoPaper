using ExoPaperRAG.Domain.Entities;
using Xunit;

namespace ExoPaperRAG.Tests.Domain;

public class ExoplanetTests
{
    private static Exoplanet Make() =>
        Exoplanet.Create(
            name: "Kepler 22 b",
            discoveryMethod: "Transit",
            massEarth: 1.0,
            lowerBoundMassEarth: null,
            radiusEarth: 2.4,
            radiusJupiter: null,
            orbitalPeriodDays: 290,
            eccentricity: null,
            semiMajorAxisAu: 0.85,
            stellarEffectiveTemperatureK: 5518,
            distanceParsecs: 190);

    [Fact]
    public void BuildId_slugifies_spaces()
    {
        Assert.Equal("exoplanets/Kepler-22-b", Exoplanet.BuildId("Kepler 22 b"));
    }

    [Fact]
    public void Create_rejects_empty_name()
    {
        Assert.Throws<ArgumentException>(() => Exoplanet.Create(
            "  ", null, null, null, null, null, null, null, null, null, null));
    }

    [Fact]
    public void ApplyScientificUpdate_no_change_returns_false_and_keeps_enrichment()
    {
        var planet = Make();
        planet.Tags.Add("HWO Candidate");
        planet.TagsProcessed = true;

        var changed = planet.ApplyScientificUpdate(
            "Transit", 1.0, null, 2.4, null, 290, null, 0.85, 5518, 190);

        Assert.False(changed);
        Assert.True(planet.TagsProcessed);            // enrichment preserved
        Assert.Contains("HWO Candidate", planet.Tags);
    }

    [Fact]
    public void ApplyScientificUpdate_change_resets_tagging_but_keeps_tags_list()
    {
        var planet = Make();
        planet.Tags.Add("HWO Candidate");
        planet.TagsProcessed = true;

        var changed = planet.ApplyScientificUpdate(
            "Transit", 1.5 /* mass changed */, null, 2.4, null, 290, null, 0.85, 5518, 190);

        Assert.True(changed);
        Assert.False(planet.TagsProcessed);           // flagged for re-tagging
        Assert.Equal(1.5, planet.MassEarth);
    }
}
