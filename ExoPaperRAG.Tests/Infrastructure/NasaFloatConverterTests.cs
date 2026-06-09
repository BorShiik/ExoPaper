using System.Text.Json;
using ExoPaperRAG.Infrastructure.Converters;
using Xunit;

namespace ExoPaperRAG.Tests.Infrastructure;

public class NasaFloatConverterTests
{
    private static JsonSerializerOptions Options()
    {
        var o = new JsonSerializerOptions();
        o.Converters.Add(new NasaFloatConverter());
        return o;
    }

    [Theory]
    [InlineData("2.5", 2.5)]      // numeric token
    [InlineData("\"2.5\"", 2.5)]  // numeric string
    [InlineData("\".85\"", 0.85)] // missing leading zero
    [InlineData("\"-.85\"", -0.85)]
    public void Parses_values(string json, double expected)
    {
        var result = JsonSerializer.Deserialize<double?>(json, Options());
        Assert.NotNull(result);
        Assert.Equal(expected, result!.Value, 4);
    }

    [Theory]
    [InlineData("null")]
    [InlineData("\"\"")]
    [InlineData("\"   \"")]
    [InlineData("\"not-a-number\"")]
    public void Returns_null_for_empty_or_invalid(string json)
    {
        var result = JsonSerializer.Deserialize<double?>(json, Options());
        Assert.Null(result);
    }
}
