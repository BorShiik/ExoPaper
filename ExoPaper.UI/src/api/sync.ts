import api from "./client";

export async function triggerNasaSync(): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/sync/nasa");
  return data;
}

export async function triggerArxivHarvest(): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/sync/arxiv");
  return data;
}
