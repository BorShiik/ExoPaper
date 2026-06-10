// ═══════════════════════════════════════════════════════════
//  ExoPaper RAG — i18n dictionary
//  Two locales: English (en) · Polish (pl)
//  Keys are dot-namespaced by feature area.
// ═══════════════════════════════════════════════════════════

export type Locale = "en" | "pl";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "EN" },
  { code: "pl", label: "Polski", flag: "PL" },
];

// The English dictionary is the source of truth for the key set.
const en = {
  // ─── Brand / nav ───────────────────────────────────────
  "brand.name": "ExoPaper",
  "brand.tagline": "RAG System",
  "nav.dashboard": "Dashboard",
  "nav.papers": "Papers",
  "nav.planets": "Planets",
  "page.planets": "Exoplanet Catalog",
  "planets.namePlaceholder": "Filter by name…",
  "planets.empty": "No exoplanets yet. Run NASA Sync to populate the catalog.",
  "planets.loadMore": "Load more planets",
  "planets.view3d": "View 3D model",
  "nav.menu": "Menu",
  "conn.live": "Live",
  "conn.disconnected": "Disconnected",
  "conn.reconnecting": "Reconnecting…",

  // ─── Header ─────────────────────────────────────────────
  "header.nasaSync": "NASA Sync",
  "header.arxivHarvest": "arXiv Harvest",
  "header.language": "Language",
  "header.graphics": "Graphics Quality",

  // ─── Page titles ────────────────────────────────────────
  "page.dashboard": "Dashboard & RAG Search",
  "page.papers": "Publication Explorer",
  "page.planet": "Exoplanet Observatory",

  // ─── Home hero ──────────────────────────────────────────
  "hero.kicker": "Hybrid Retrieval-Augmented Generation",
  "hero.title": "Exoplanet Research & Publication Search",
  "hero.subtitle":
    "Query astrophysical research papers alongside dynamic exoplanetary parameters. Our hybrid RAG pipeline pairs vector embeddings with RavenDB structured indexing to surface precise scientific insight.",
  "hero.scroll": "Explore the data",

  // ─── Dashboard sections ─────────────────────────────────
  "dash.metrics": "Overview Metrics",
  "dash.discoveryMethods": "Discovery Methods",
  "dash.liveFeed": "Live Event Feed",

  // ─── Stats ──────────────────────────────────────────────
  "stats.exoplanets": "Exoplanets",
  "stats.habitable": "Habitable Zone",
  "stats.methods": "Discovery Methods",
  "stats.hwo": "HWO Candidates",

  // ─── Search (hybrid) ────────────────────────────────────
  "search.placeholder": "Hybrid RAG search: effect of dust on direct imaging…",
  "search.button": "Search",
  "search.filters": "Filters",
  "search.maxMass": "Max Mass (M⊕)",
  "search.discoveryMethod": "Discovery Method",
  "search.results": "Results",
  "search.any": "Any",
  "search.found": "Found {count} result(s)",
  "search.none": "No papers found for this query.",
  "search.noneHint": "Try adjusting your search text or filters.",
  "search.more": "+{count} more",

  // ─── Discovery methods (values) ─────────────────────────
  "method.transit": "Transit",
  "method.radialVelocity": "Radial Velocity",
  "method.microlensing": "Microlensing",
  "method.directImaging": "Direct Imaging",
  "method.ttv": "Transit Timing Variations",

  // ─── Discovery chart ────────────────────────────────────
  "chart.title": "Discovery Methods",
  "chart.empty": "No data available. Run NASA Sync first.",

  // ─── Live feed ──────────────────────────────────────────
  "feed.title": "Live Feed",
  "feed.realtime": "Real-time",
  "feed.waiting": "Waiting for events from the live hub…",
  "feed.paperEmbedded": 'Paper "{title}" vectorized',
  "feed.exoplanetTagged": "{planet} tagged: {tags}",

  // ─── Papers page ────────────────────────────────────────
  "papers.searchPlaceholder":
    "Search paper abstracts (e.g. atmospheric biosignatures, transit depth, direct imaging…)",
  "papers.empty": "No papers match your search.",
  "papers.loadMore": "Load More Publications",
  "papers.error": "Failed to fetch papers. Is the backend running?",
  "papers.authors": "{count} author(s)",
  "papers.reviewed": "Reviewed",
  "papers.linkedPlanets": "{count} linked planet(s)",
  "papers.detailsKicker": "Astrophysics Publication",
  "papers.published": "Published",
  "papers.documentId": "Document ID",
  "papers.authorsAffiliations": "Authors & Affiliations",
  "papers.noAuthors": "No author data available.",
  "papers.unknownAffiliation": "Unknown Affiliation",
  "papers.abstract": "Abstract",
  "papers.linkedExoplanets": "Linked Exoplanets",
  "papers.resolving": "Resolving author affiliations & index references…",
  "papers.detailsError": "Failed to load full publication details.",
  "papers.close": "Close Details",

  // ─── Planet detail ──────────────────────────────────────
  "planet.back": "Back to Dashboard",
  "planet.decoding": "Decoding astrophysical data…",
  "planet.retrievalFailed": "Retrieval Failed",
  "planet.notFound": "Exoplanet not found or API is unavailable.",
  "planet.returnHome": "Return Home",
  "planet.model3d": "3D Interactive Model",
  "planet.unknownMethod": "Unknown method",

  // ─── Parameters ─────────────────────────────────────────
  "param.title": "Parameters",
  "param.mass": "Mass",
  "param.lowerMass": "Lower Bound Mass",
  "param.radius": "Radius",
  "param.radiusJup": "Radius (Jup)",
  "param.period": "Orbital Period",
  "param.eccentricity": "Eccentricity",
  "param.semiMajor": "Semi-Major Axis",
  "param.stellarTeff": "Stellar T_eff",
  "param.distance": "Distance",
  "param.days": "days",
  "param.massJup": "Mass (Jup)",
  "param.msini": "M·sin(i)",
  "param.density": "Density",
  "param.inclination": "Inclination",
  "param.eqTemp": "Equilibrium Temp.",
  "param.insolation": "Insolation",
  "param.spectralType": "Spectral Type",
  "param.stellarRadius": "Stellar Radius",
  "param.stellarMass": "Stellar Mass",
  "param.stellarAge": "Stellar Age",
  "param.discoveryYear": "Discovery Year",
  "param.discoveryFacility": "Facility",
  "param.numberOfPlanets": "Planets in System",
  "param.estimated": "estimated",
  "param.section.planet": "Planet",
  "param.section.orbit": "Orbit",
  "param.section.star": "Host Star",
  "param.section.system": "System & Discovery",
  "param.completeness": "Data completeness",
  "param.source": "Source: NASA Exoplanet Archive",
  "param.estimatedLegend": "≈ estimated from related parameters",
  "param.controversial": "Controversial detection",
  "type.terrestrial": "Terrestrial",
  "type.superEarth": "Super-Earth",
  "type.subNeptune": "Sub-Neptune",
  "type.neptunelike": "Neptune-like",
  "type.gasGiant": "Gas Giant",

  // ─── Uncertainty panel ──────────────────────────────────
  "unc.title": "Uncertainty Tracking",
  "unc.analyze": "Analyze Discrepancies (AI)",
  "unc.analyzing": "Analyzing…",
  "unc.aiAnalysis": "AI Analysis",
  "unc.referenced": "Referenced Papers ({count})",
  "unc.hint":
    'Click "Analyze Discrepancies" to generate an AI summary of conflicting measurements across publications.',
  "unc.error": "Failed to generate analysis. Is the model server running?",
  "unc.disparities": "Measurement Disparities",
  "unc.measurements": "measurements",
  "unc.spread": "spread",
  "unc.conflict": "conflict",
  "unc.consistent": "consistent",
  "unc.sources": "sources",
  "unc.noMeasure": "No published measurements with error bars found in the NASA catalog.",

  // ─── Linked papers ──────────────────────────────────────
  "linked.title": "Linked Publications",
  "linked.empty": "No papers linked to this exoplanet yet.",
  "linked.error": "Failed to load associated papers.",
  "linked.harvest": "Search arXiv",
  "linked.harvesting": "Searching arXiv…",
  "health.title": "Pipeline Coverage",
  "health.planets": "Planets",
  "health.papers": "Papers",
  "health.embedded": "Embedded",
  "health.linked": "Linked",

  // ─── Generic ────────────────────────────────────────────
  "ask.title": "Ask the AI",
  "ask.placeholder": "Ask about this planet…",
  "ask.button": "Ask",
  "ask.sources": "Sources",
  "ask.thinking": "Thinking…",
  "ask.error": "Failed to get an answer. Is the model server running?",
  "ask.offline": "Live connection required.",
  "common.na": "N/A",

  // ─── Synthesis panel ─────────────────────────────────────
  "synthesis.title": "Planet Profile",
  "synthesis.planetType": "Planet Classification",
  "synthesis.highlights": "Key Highlights",
  "synthesis.habitability": "Habitability Assessment",
  "synthesis.comparative": "Comparative Context",
  "synthesis.atmosphere": "Atmosphere & Climate",
  "synthesis.orbital": "Orbital Dynamics",
  "synthesis.hostStar": "Host Star Analysis",
  "synthesis.literature": "Literature Synthesis",
  "synthesis.openQuestions": "Open Questions",
  "synthesis.generate": "Generate Planet Profile",
  "synthesis.regenerate": "Regenerate",
  "synthesis.expandAll": "Expand All",
  "synthesis.collapseAll": "Collapse All",
  "synthesis.translating": "Translating…",
  "synthesis.noData": "Insufficient data for this section.",
} as const;

export type TranslationKey = keyof typeof en;

const pl: Record<TranslationKey, string> = {
  // ─── Brand / nav ───────────────────────────────────────
  "brand.name": "ExoPaper",
  "brand.tagline": "System RAG",
  "nav.dashboard": "Pulpit",
  "nav.papers": "Publikacje",
  "nav.planets": "Planety",
  "page.planets": "Katalog egzoplanet",
  "planets.namePlaceholder": "Filtruj po nazwie…",
  "planets.empty": "Brak egzoplanet. Uruchom synchronizację NASA, aby wypełnić katalog.",
  "planets.loadMore": "Wczytaj więcej planet",
  "planets.view3d": "Zobacz model 3D",
  "nav.menu": "Menu",
  "conn.live": "Na żywo",
  "conn.disconnected": "Rozłączono",
  "conn.reconnecting": "Ponowne łączenie…",

  // ─── Header ─────────────────────────────────────────────
  "header.nasaSync": "Synchr. NASA",
  "header.arxivHarvest": "Pobierz arXiv",
  "header.language": "Język",
  "header.graphics": "Jakość Grafiki",

  // ─── Page titles ────────────────────────────────────────
  "page.dashboard": "Pulpit i wyszukiwanie RAG",
  "page.papers": "Eksplorator publikacji",
  "page.planet": "Obserwatorium egzoplanet",

  // ─── Home hero ──────────────────────────────────────────
  "hero.kicker": "Hybrydowa generacja wspomagana wyszukiwaniem",
  "hero.title": "Badania egzoplanet i wyszukiwanie publikacji",
  "hero.subtitle":
    "Przeszukuj astrofizyczne prace naukowe wraz z dynamicznymi parametrami egzoplanet. Nasz hybrydowy potok RAG łączy osadzenia wektorowe z indeksowaniem strukturalnym RavenDB, by dostarczać precyzyjną wiedzę naukową.",
  "hero.scroll": "Poznaj dane",

  // ─── Dashboard sections ─────────────────────────────────
  "dash.metrics": "Wskaźniki ogólne",
  "dash.discoveryMethods": "Metody odkrycia",
  "dash.liveFeed": "Strumień zdarzeń na żywo",

  // ─── Stats ──────────────────────────────────────────────
  "stats.exoplanets": "Egzoplanety",
  "stats.habitable": "Strefa zamieszkania",
  "stats.methods": "Metody odkrycia",
  "stats.hwo": "Kandydaci HWO",

  // ─── Search (hybrid) ────────────────────────────────────
  "search.placeholder": "Wyszukiwanie hybrydowe RAG: wpływ pyłu na obrazowanie bezpośrednie…",
  "search.button": "Szukaj",
  "search.filters": "Filtry",
  "search.maxMass": "Maks. masa (M⊕)",
  "search.discoveryMethod": "Metoda odkrycia",
  "search.results": "Wyniki",
  "search.any": "Dowolna",
  "search.found": "Znaleziono {count} wynik(ów)",
  "search.none": "Nie znaleziono publikacji dla tego zapytania.",
  "search.noneHint": "Spróbuj zmienić tekst wyszukiwania lub filtry.",
  "search.more": "+{count} więcej",

  // ─── Discovery methods (values) ─────────────────────────
  "method.transit": "Tranzyt",
  "method.radialVelocity": "Prędkość radialna",
  "method.microlensing": "Mikrosoczewkowanie",
  "method.directImaging": "Obrazowanie bezpośrednie",
  "method.ttv": "Zmiany czasu tranzytu",

  // ─── Discovery chart ────────────────────────────────────
  "chart.title": "Metody odkrycia",
  "chart.empty": "Brak danych. Uruchom najpierw synchronizację NASA.",

  // ─── Live feed ──────────────────────────────────────────
  "feed.title": "Strumień na żywo",
  "feed.realtime": "Czas rzeczywisty",
  "feed.waiting": "Oczekiwanie na zdarzenia z huba…",
  "feed.paperEmbedded": 'Publikacja "{title}" zwektoryzowana',
  "feed.exoplanetTagged": "{planet} otagowano: {tags}",

  // ─── Papers page ────────────────────────────────────────
  "papers.searchPlaceholder":
    "Przeszukaj streszczenia (np. biosygnatury atmosferyczne, głębokość tranzytu, obrazowanie bezpośrednie…)",
  "papers.empty": "Brak publikacji pasujących do wyszukiwania.",
  "papers.loadMore": "Wczytaj więcej publikacji",
  "papers.error": "Nie udało się pobrać publikacji. Czy backend działa?",
  "papers.authors": "{count} autor(ów)",
  "papers.reviewed": "Recenzowana",
  "papers.linkedPlanets": "{count} powiązana planeta(y)",
  "papers.detailsKicker": "Publikacja astrofizyczna",
  "papers.published": "Opublikowano",
  "papers.documentId": "ID dokumentu",
  "papers.authorsAffiliations": "Autorzy i afiliacje",
  "papers.noAuthors": "Brak danych o autorach.",
  "papers.unknownAffiliation": "Nieznana afiliacja",
  "papers.abstract": "Streszczenie",
  "papers.linkedExoplanets": "Powiązane egzoplanety",
  "papers.resolving": "Ustalanie afiliacji autorów i odniesień indeksu…",
  "papers.detailsError": "Nie udało się wczytać pełnych szczegółów publikacji.",
  "papers.close": "Zamknij szczegóły",

  // ─── Planet detail ──────────────────────────────────────
  "planet.back": "Powrót do pulpitu",
  "planet.decoding": "Dekodowanie danych astrofizycznych…",
  "planet.retrievalFailed": "Pobieranie nie powiodło się",
  "planet.notFound": "Nie znaleziono egzoplanety lub API jest niedostępne.",
  "planet.returnHome": "Wróć na stronę główną",
  "planet.model3d": "Interaktywny model 3D",
  "planet.unknownMethod": "Nieznana metoda",

  // ─── Parameters ─────────────────────────────────────────
  "param.title": "Parametry",
  "param.mass": "Masa",
  "param.lowerMass": "Dolna granica masy",
  "param.radius": "Promień",
  "param.radiusJup": "Promień (Jow.)",
  "param.period": "Okres orbitalny",
  "param.eccentricity": "Mimośród",
  "param.semiMajor": "Półoś wielka",
  "param.stellarTeff": "T_eff gwiazdy",
  "param.distance": "Odległość",
  "param.days": "dni",
  "param.massJup": "Masa (Jow.)",
  "param.msini": "M·sin(i)",
  "param.density": "Gęstość",
  "param.inclination": "Inklinacja",
  "param.eqTemp": "Temp. równowagi",
  "param.insolation": "Insolacja",
  "param.spectralType": "Typ widmowy",
  "param.stellarRadius": "Promień gwiazdy",
  "param.stellarMass": "Masa gwiazdy",
  "param.stellarAge": "Wiek gwiazdy",
  "param.discoveryYear": "Rok odkrycia",
  "param.discoveryFacility": "Obserwatorium",
  "param.numberOfPlanets": "Planet w układzie",
  "param.estimated": "szacowane",
  "param.section.planet": "Planeta",
  "param.section.orbit": "Orbita",
  "param.section.star": "Gwiazda macierzysta",
  "param.section.system": "Układ i odkrycie",
  "param.completeness": "Kompletność danych",
  "param.source": "Źródło: NASA Exoplanet Archive",
  "param.estimatedLegend": "≈ szacowane z powiązanych parametrów",
  "param.controversial": "Kontrowersyjne wykrycie",
  "type.terrestrial": "Skalista",
  "type.superEarth": "Superziemia",
  "type.subNeptune": "Sub-Neptun",
  "type.neptunelike": "Typu Neptuna",
  "type.gasGiant": "Gazowy olbrzym",

  // ─── Uncertainty panel ──────────────────────────────────
  "unc.title": "Śledzenie niepewności",
  "unc.analyze": "Analizuj rozbieżności (AI)",
  "unc.analyzing": "Analizowanie…",
  "unc.aiAnalysis": "Analiza AI",
  "unc.referenced": "Cytowane publikacje ({count})",
  "unc.hint":
    'Kliknij "Analizuj rozbieżności", aby wygenerować analizę AI sprzecznych pomiarów w publikacjach.',
  "unc.error": "Nie udało się wygenerować analizy. Czy serwer modelu działa?",
  "unc.disparities": "Rozbieżności pomiarów",
  "unc.measurements": "pomiarów",
  "unc.spread": "rozrzut",
  "unc.conflict": "konflikt",
  "unc.consistent": "zgodne",
  "unc.sources": "źródła",
  "unc.noMeasure": "Brak opublikowanych pomiarów z błędami w katalogu NASA.",

  // ─── Linked papers ──────────────────────────────────────
  "linked.title": "Powiązane publikacje",
  "linked.empty": "Brak publikacji powiązanych z tą egzoplanetą.",
  "linked.error": "Nie udało się wczytać powiązanych publikacji.",
  "linked.harvest": "Szukaj w arXiv",
  "linked.harvesting": "Szukanie w arXiv…",
  "health.title": "Pokrycie pipeline",
  "health.planets": "Planety",
  "health.papers": "Publikacje",
  "health.embedded": "Wektoryzacja",
  "health.linked": "Powiązania",

  // ─── Generic ────────────────────────────────────────────
  "ask.title": "Spytaj AI",
  "ask.placeholder": "Zapytaj o tę planetę…",
  "ask.button": "Zapytaj",
  "ask.sources": "Źródła",
  "ask.thinking": "Myślę…",
  "ask.error": "Nie udało się uzyskać odpowiedzi. Czy serwer modelu działa?",
  "ask.offline": "Wymagane połączenie na żywo.",
  "common.na": "—",

  // ─── Synthesis panel ─────────────────────────────────────
  "synthesis.title": "Profil planety",
  "synthesis.planetType": "Klasyfikacja planety",
  "synthesis.highlights": "Kluczowe fakty",
  "synthesis.habitability": "Ocena zamieszkiwalności",
  "synthesis.comparative": "Kontekst porównawczy",
  "synthesis.atmosphere": "Atmosfera i klimat",
  "synthesis.orbital": "Dynamika orbitalna",
  "synthesis.hostStar": "Analiza gwiazdy macierzystej",
  "synthesis.literature": "Synteza literatury",
  "synthesis.openQuestions": "Otwarte pytania",
  "synthesis.generate": "Generuj profil planety",
  "synthesis.regenerate": "Regeneruj",
  "synthesis.expandAll": "Rozwiń wszystko",
  "synthesis.collapseAll": "Zwiń wszystko",
  "synthesis.translating": "Tłumaczenie…",
  "synthesis.noData": "Niewystarczające dane dla tej sekcji.",
};

export const dictionaries = { en, pl };