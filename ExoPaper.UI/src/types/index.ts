// ═══════════════════════════════════════════════════════════
//  ExoPaper RAG — TypeScript Domain Types
//  Mirrors C# entities from ExoPaperRAG.Domain.Entities
// ═══════════════════════════════════════════════════════════

export interface Exoplanet {
  id: string;
  name: string;
  discoveryMethod?: string | null;

  // Identity / system
  hostName?: string | null;
  planetLetter?: string | null;
  aliases?: string[];
  numberOfStars?: number | null;
  numberOfPlanets?: number | null;
  rightAscension?: number | null;
  declination?: number | null;
  vMagnitude?: number | null;
  kMagnitude?: number | null;
  gaiaMagnitude?: number | null;

  // Discovery
  discoveryYear?: number | null;
  discoveryFacility?: string | null;
  discoveryTelescope?: string | null;
  discoveryInstrument?: string | null;

  // Mass / radius / density
  massEarth?: number | null;
  lowerBoundMassEarth?: number | null;
  massJupiter?: number | null;
  massProvenance?: string | null;
  msiniEarth?: number | null;
  massIsDerived?: boolean;
  radiusEarth?: number | null;
  radiusJupiter?: number | null;
  radiusIsDerived?: boolean;
  densityGramPerCm3?: number | null;

  // Orbit
  orbitalPeriodDays?: number | null;
  eccentricity?: number | null;
  semiMajorAxisAu?: number | null;
  inclinationDeg?: number | null;

  // Climate
  equilibriumTemperatureK?: number | null;
  equilibriumTemperatureIsDerived?: boolean;
  insolationFlux?: number | null;

  // Host star
  spectralType?: string | null;
  stellarEffectiveTemperatureK?: number | null;
  stellarRadiusSolar?: number | null;
  stellarMassSolar?: number | null;
  stellarLuminosityLogSolar?: number | null;
  stellarSurfaceGravity?: number | null;
  stellarMetallicity?: number | null;
  stellarAgeGyr?: number | null;

  // System
  distanceParsecs?: number | null;
  isControversial?: boolean | null;
  /** 0–100: share of key parameters populated (data-quality signal). */
  completenessPercent?: number;

  hasEmbeddings: boolean;
  tags: string[];
  tagsProcessed: boolean;
  /** True when a cached RAG uncertainty analysis already exists for this planet. */
  hasCachedUncertainty?: boolean;
  /** True when a cached AI general summary exists. */
  hasCachedAiSummary?: boolean;
}

export interface Paper {
  id: string;
  title: string;
  abstract: string;
  publishedDate: string;
  authorIds: string[];
  exoplanetIds: string[];
  hasEmbeddings: boolean;
  vector?: number[] | null;
  isReviewed: boolean;
}

export interface Author {
  id: string;
  name: string;
  affiliation: string;
}

// MapReduce index result
export interface DiscoveryStats {
  discoveryMethod: string;
  count: number;
  totalMass: number;
  averageMass: number;
}

// Uncertainty Tracking
export interface ConflictingMeasurement {
  paperTitle: string;
  paperId: string;
  relevantText: string;
}

// A single published measurement of one parameter (NASA "ps").
export interface ParameterMeasurement {
  parameter: string;
  unit: string;
  value: number;
  errorPlus?: number | null;
  errorMinus?: number | null;
  reference?: string | null;
  isDefault: boolean;
}

// Aggregated per-parameter discrepancy view across publications.
export interface ParameterDisparity {
  parameter: string;
  unit: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  defaultValue?: number | null;
  spreadPercent: number;
  isConflicting: boolean;
  measurements: ParameterMeasurement[];
}

export interface UncertaintySummary {
  exoplanetId: string;
  exoplanetName: string;
  analysisSummary: string;
  disparities: ParameterDisparity[];
  conflicts: ConflictingMeasurement[];
}

// AI General Summary (Rich Structured Profile)
export interface PlanetAiSummaryResult {
  exoplanetId: string;
  exoplanetName?: string;
  planetType: string;
  shortSummary: string;
  keyHighlights: string;
  habitabilityAssessment: string;
  comparativeContext: string;
  atmosphereClimate: string;
  orbitalDynamics: string;
  hostStarAnalysis: string;
  literatureSynthesis: string;
  openQuestions: string;
  detailedSummary: string;
}

// Hybrid Search (RAG)
export interface HybridSearchRequest {
  searchText: string;
  maxMassEarth?: number | null;
  discoveryMethod?: string | null;
  take?: number;
}

export interface PaperSearchHit {
  id: string;
  title: string;
  abstract: string;
  publishedDate: string;
  exoplanetIds: string[];
}

export interface HybridSearchResult {
  papers: PaperSearchHit[];
}

// Paper with Authors (Include)
export interface PaperWithAuthors {
  paper: Paper;
  authors: Author[];
}

// SignalR event payloads
export interface PaperEmbeddedPayload {
  paperId: string;
  title: string;
}

export interface ExoplanetTaggedPayload {
  planetId: string;
  tags: string[];
}

export interface RealtimeEvent {
  id: string;
  eventType: string;
  payload: string;
  timestamp: Date;
}
