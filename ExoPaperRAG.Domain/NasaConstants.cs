namespace ExoPaperRAG.Domain
{
    public static class NasaTables
    {
        public const string ConfirmedPlanets = "pscomppars";
        public const string AllPublications = "ps";
    }

    public static class NasaColumns
    {
        // Identity / system
        public const string PlanetName = "pl_name";
        public const string HostName = "hostname";
        public const string PlanetLetter = "pl_letter";
        public const string NumberOfStars = "sy_snum";
        public const string NumberOfPlanets = "sy_pnum";
        public const string RightAscension = "ra";
        public const string Declination = "dec";
        public const string VMagnitude = "sy_vmag";
        public const string KMagnitude = "sy_kmag";
        public const string GaiaMagnitude = "sy_gaiamag";

        // Aliases
        public const string HdName = "hd_name";
        public const string HipName = "hip_name";
        public const string TicId = "tic_id";

        // Discovery
        public const string DiscoveryMethod = "discoverymethod";
        public const string DiscoveryYear = "disc_year";
        public const string DiscoveryFacility = "disc_facility";
        public const string DiscoveryTelescope = "disc_telescope";
        public const string DiscoveryInstrument = "disc_instrument";

        // Orbit
        public const string OrbitalPeriod = "pl_orbper";
        public const string OrbitalEccentricity = "pl_orbeccen";
        public const string SemiMajorAxis = "pl_orbsmax";
        public const string Inclination = "pl_orbincl";

        // Mass / radius / density
        public const string MassEarth = "pl_masse";
        public const string LowerBoundMassEarth = "pl_bmasse";
        public const string MassJupiter = "pl_bmassj";
        public const string MassProvenance = "pl_bmassprov";
        public const string MsiniEarth = "pl_msinie";
        public const string RadiusEarth = "pl_rade";
        public const string RadiusJupiter = "pl_radj";
        public const string Density = "pl_dens";

        // Climate
        public const string EquilibriumTemperature = "pl_eqt";
        public const string InsolationFlux = "pl_insol";

        // Host star
        public const string SpectralType = "st_spectype";
        public const string StellarEffTemp = "st_teff";
        public const string StellarRadius = "st_rad";
        public const string StellarMass = "st_mass";
        public const string StellarLuminosity = "st_lum";
        public const string StellarSurfaceGravity = "st_logg";
        public const string StellarMetallicity = "st_met";
        public const string StellarAge = "st_age";

        // System
        public const string Distance = "sy_dist";

        // Quality / provenance
        public const string SolutionType = "soltype";
        public const string ControversialFlag = "pl_controv_flag";
        public const string ReferenceName = "pl_refname";
        public const string UpdateDate = "releasedate";
    }
}
