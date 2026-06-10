import api from "./client";
import type { Exoplanet, DiscoveryStats, UncertaintySummary, PlanetAiSummaryResult } from "../types";

export async function getExoplanets(params?: {
  discoveryMethod?: string;
  skip?: number;
  take?: number;
  sortBy?: string;
}): Promise<Exoplanet[]> {
  const { data } = await api.get<Exoplanet[]>("/exoplanets", { params });
  return data;
}

export async function getExoplanetById(id: string): Promise<Exoplanet> {
  const { data } = await api.get<Exoplanet>("/exoplanets/by-id", { params: { id } });
  return data;
}

export async function getHabitablePlanets(skip = 0, take = 50): Promise<Exoplanet[]> {
  const { data } = await api.get<Exoplanet[]>("/exoplanets/habitable", {
    params: { skip, take },
  });
  return data;
}

export async function getDiscoveryStats(): Promise<DiscoveryStats[]> {
  const { data } = await api.get<DiscoveryStats[]>("/exoplanets/stats");
  return data;
}

export async function getHwoCandidateCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>("/exoplanets/hwo-count");
  return data.count;
}

export async function getUncertaintySummary(
  id: string,
  regenerate = false
): Promise<UncertaintySummary> {
  const { data } = await api.get<UncertaintySummary>("/exoplanets/uncertainty", {
    params: { id, regenerate },
  });
  return data;
}

export async function getPlanetSummary(
  id: string,
  regenerate = false
): Promise<PlanetAiSummaryResult> {
  const { data } = await api.get<PlanetAiSummaryResult>("/exoplanets/summary", {
    params: { id, regenerate },
  });
  return data;
}

export interface HarvestPapersResult {
  linkedCount: number;
  message: string;
}

/** On-demand: search arXiv for this planet and link matching papers. */
export async function harvestPapersForPlanet(id: string): Promise<HarvestPapersResult> {
  const { data } = await api.post<HarvestPapersResult>("/exoplanets/harvest", null, {
    params: { id },
  });
  return data;
}
