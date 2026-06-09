using ExoPaperRAG.Domain.Entities;
using ExoPaperRAG.Domain.Rules;
using Xunit;

namespace ExoPaperRAG.Tests.Domain;

public class HwoCandidateRuleTests
{
    private static readonly HwoCandidateRule Rule = new();

    private static Exoplanet Make(double? radiusEarth, double? massEarth, double? teff) =>
        Exoplanet.Create(
            name: "Test",
            discoveryMethod: "Transit",
            massEarth: massEarth,
            lowerBoundMassEarth: null,
            radiusEarth: radiusEarth,
            radiusJupiter: null,
            orbitalPeriodDays: null,
            eccentricity: null,
            semiMajorAxisAu: null,
            stellarEffectiveTemperatureK: teff,
            distanceParsecs: null);

    [Fact]
    public void Matches_small_rocky_planet_around_sunlike_star()
    {
        var planet = Make(radiusEarth: 1.0, massEarth: null, teff: 5800);
        Assert.True(Rule.IsMatch(planet));
    }

    [Fact]
    public void Does_not_match_when_stellar_temperature_unknown()
    {
        var planet = Make(radiusEarth: 1.0, massEarth: null, teff: null);
        Assert.False(Rule.IsMatch(planet));
    }

    [Fact]
    public void Does_not_match_large_radius()
    {
        var planet = Make(radiusEarth: 3.0, massEarth: null, teff: 5800);
        Assert.False(Rule.IsMatch(planet));
    }

    [Fact]
    public void Falls_back_to_mass_when_radius_missing()
    {
        var planet = Make(radiusEarth: null, massEarth: 5.0, teff: 5800);
        Assert.True(Rule.IsMatch(planet));
    }

    [Theory]
    [InlineData(2000, false)] // too cold
    [InlineData(2400, true)]  // lower bound
    [InlineData(7500, true)]  // upper bound
    [InlineData(8000, false)] // too hot
    public void Respects_temperature_window(double teff, bool expected)
    {
        var planet = Make(radiusEarth: 1.0, massEarth: null, teff: teff);
        Assert.Equal(expected, Rule.IsMatch(planet));
    }

    [Fact]
    public void Tag_name_is_stable()
    {
        Assert.Equal("HWO Candidate", Rule.TagName);
    }
}
