using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ExoPaperRAG.Infrastructure.Settings
{
    public class RavenSettings
    {
        public const string SectionName = "RavenSettings";
        public string[] Urls { get; set; } = Array.Empty<string>();
        public string DatabaseName { get; set; } = string.Empty;
    }
}
