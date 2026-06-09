namespace ExoPaperRAG.Domain
{
    public static class NasaTables
    {
        public const string ConfirmedPlanets = "pscomppars";
        public const string AllPublications = "ps";
    }

    public static class NasaColumns
    {
        public const string PlanetName = "pl_name";
        public const string HostName = "hostname";
        public const string DiscoveryMethod = "discoverymethod";
        public const string MassEarth = "pl_masse";
        public const string LowerBoundMassEarth = "pl_bmasse";
        public const string RadiusEarth = "pl_rade";
        public const string RadiusJupiter = "pl_radj";
        public const string OrbitalPeriod = "pl_orbper";
        public const string OrbitalEccentricity = "pl_orbeccen";
        public const string SemiMajorAxis = "pl_orbsmax";
        public const string StellarEffTemp = "st_teff";
        public const string Distance = "sy_dist";
        public const string UpdateDate = "releasedate";
    }
}
