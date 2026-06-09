// ═══════════════════════════════════════════════════════════
//  ExoPaper RAG — TypeScript Domain Types
//  Mirrors C# entities from ExoPaperRAG.Domain.Entities
// ═══════════════════════════════════════════════════════════

export interface Exoplanet {
  id: string;
  name: string;
  discoveryMethod?: string | null;
  massEarth?: number | null;
  lowerBoundMassEarth?: number | null;
  radiusEarth?: number | null;
  radiusJupiter?: number | null;
  orbitalPeriodDays?: number | null;
  eccentricity?: number | null;
  semiMajorAxisAu?: number | null;
  stellarEffectiveTemperatureK?: number | null;
  distanceParsecs?: number | null;
  hasEmbeddings: boolean;
  tags: string[];
  tagsProcessed: boolean;
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

// Uncertainty Tracking (LLM-generated)
export interface ConflictingMeasurement {
  paperTitle: string;
  paperId: string;
  relevantText: string;
}

export interface UncertaintySummary {
  exoplanetId: string;
  exoplanetName: string;
  analysisSummary: string;
  conflicts: ConflictingMeasurement[];
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
