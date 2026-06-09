import api from "./client";
import type {
  Paper,
  HybridSearchRequest,
  HybridSearchResult,
  PaperWithAuthors,
} from "../types";

export async function searchPapers(
  query: string,
  skip = 0,
  take = 10
): Promise<Paper[]> {
  const { data } = await api.get<Paper[]>("/papers/search", {
    params: { query, skip, take },
  });
  return data;
}

export async function hybridSearch(
  request: HybridSearchRequest
): Promise<HybridSearchResult> {
  const { data } = await api.post<HybridSearchResult>(
    "/papers/hybrid-search",
    request
  );
  return data;
}

export async function getPaperWithAuthors(
  id: string
): Promise<PaperWithAuthors> {
  const { data } = await api.get<PaperWithAuthors>("/papers/with-authors", {
    params: { id },
  });
  return data;
}

export async function findSimilarPapers(
  queryVector: number[],
  take = 5
): Promise<Paper[]> {
  const { data } = await api.post<Paper[]>("/papers/similar", queryVector, {
    params: { take },
  });
  return data;
}

export async function getPapersByExoplanet(
  exoplanetId: string,
  skip = 0,
  take = 10
): Promise<Paper[]> {
  const { data } = await api.get<Paper[]>("/papers/by-exoplanet", {
    params: { exoplanetId, skip, take },
  });
  return data;
}
