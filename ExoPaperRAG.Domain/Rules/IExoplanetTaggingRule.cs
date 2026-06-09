using ExoPaperRAG.Domain.Entities;

namespace ExoPaperRAG.Domain.Rules;

public interface IExoplanetTaggingRule
{
    string TagName { get; }
    bool IsMatch(Exoplanet planet);
}
