using System.ComponentModel.DataAnnotations;

namespace ExoPaperRAG.Infrastructure.Settings;

public class NasaApiSettings
{
    public const string SectionName = "NasaApiSettings";

    [Required(AllowEmptyStrings = false)]
    public string BaseUrl { get; set; } = string.Empty;
}
