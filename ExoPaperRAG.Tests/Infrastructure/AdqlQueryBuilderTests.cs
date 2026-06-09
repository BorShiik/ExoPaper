using ExoPaperRAG.Infrastructure.Services;
using Xunit;

namespace ExoPaperRAG.Tests.Infrastructure;

public class AdqlQueryBuilderTests
{
    [Fact]
    public void Builds_basic_select()
    {
        var query = new AdqlQueryBuilder()
            .Select("pl_name", "pl_masse")
            .From("ps")
            .Build();

        Assert.Equal("SELECT pl_name,pl_masse From ps", query);
    }

    [Fact]
    public void Builds_top_clause()
    {
        var query = new AdqlQueryBuilder()
            .Select("pl_name")
            .From("ps")
            .Top(5)
            .Build();

        Assert.Equal("SELECT TOP 5 pl_name From ps", query);
    }

    [Fact]
    public void Builds_where_and_order_by()
    {
        var query = new AdqlQueryBuilder()
            .Select("pl_name")
            .From("ps")
            .Where("st_teff", ">", 5000)
            .WhereNotNull("pl_rade")
            .OrderBy("pl_orbper", ascending: false)
            .Build();

        Assert.Equal(
            "SELECT pl_name From ps WHERE st_teff > 5000 AND pl_rade IS NOT NULL ORDER BY pl_orbper DESC",
            query);
    }

    [Fact]
    public void Quotes_string_where_values()
    {
        var query = new AdqlQueryBuilder()
            .Select("pl_name")
            .From("ps")
            .Where("discoverymethod", "=", "Transit")
            .Build();

        Assert.Equal("SELECT pl_name From ps WHERE discoverymethod = 'Transit'", query);
    }

    [Fact]
    public void Throws_when_table_missing()
    {
        Assert.Throws<InvalidOperationException>(() =>
            new AdqlQueryBuilder().Select("pl_name").Build());
    }
}
