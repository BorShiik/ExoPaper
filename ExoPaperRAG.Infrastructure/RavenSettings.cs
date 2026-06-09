using System.ComponentModel.DataAnnotations;

namespace ExoPaperRAG.Infrastructure.Settings
{
    public class RavenSettings
    {
        public const string SectionName = "RavenSettings";

        [Required, MinLength(1, ErrorMessage = "At least one RavenDB URL is required.")]
        public string[] Urls { get; set; } = Array.Empty<string>();

        [Required(AllowEmptyStrings = false)]
        public string DatabaseName { get; set; } = string.Empty;
    }
}
