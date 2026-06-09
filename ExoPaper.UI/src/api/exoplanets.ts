import api from "./client";
import type { Exoplanet, DiscoveryStats, UncertaintySummary } from "../types";

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

export async function getUncertaintySummary(
  id: string
): Promise<UncertaintySummary> {
  const { data } = await api.get<UncertaintySummary>("/exoplanets/uncertainty", {
    params: { id },
  });
  return data;
}
