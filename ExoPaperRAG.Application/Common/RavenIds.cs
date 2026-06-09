namespace ExoPaperRAG.Application.Common;

/// <summary>Helpers for normalizing RavenDB document identifiers from API input.</summary>
public static class RavenIds
{
    /// <summary>
    /// Ensures an id carries its collection prefix, e.g. EnsurePrefix("Kepler-22b", "exoplanets/")
    /// → "exoplanets/Kepler-22b", while leaving an already-qualified id untouched.
    /// </summary>
    public static string EnsurePrefix(string id, string collectionPrefix)
        => id.StartsWith(collectionPrefix, StringComparison.OrdinalIgnoreCase)
            ? id
            : $"{collectionPrefix}{id}";
}
