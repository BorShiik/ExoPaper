import api from "./client";

export async function triggerNasaSync(): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/sync/nasa");
  return data;
}

export async function triggerArxivHarvest(): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/sync/arxiv");
  return data;
}

export interface SystemHealth {
  totalPlanets: number;
  totalPapers: number;
  papersEmbedded: number;
  papersLinked: number;
  embeddingCoveragePercent: number;
  linkingCoveragePercent: number;
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const { data } = await api.get<SystemHealth>("/sync/health");
  return data;
}
