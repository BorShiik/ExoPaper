import { create } from "zustand";
import type { HubConnection } from "@microsoft/signalr";
import type { RealtimeEvent } from "../types";

export type GraphicsQuality = "high" | "low";

/** Picks a sensible default quality from device capability (mobiles / low-core CPUs → low). */
function detectInitialQuality(): GraphicsQuality {
  if (typeof navigator === "undefined") return "high";
  const cores = navigator.hardwareConcurrency ?? 8;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const lowMemory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  if (mobile || cores <= 4 || lowMemory <= 4) return "low";
  return "high";
}

interface AppState {
  // SignalR connection
  isConnected: boolean;
  setConnected: (v: boolean) => void;
  connection: HubConnection | null;
  setConnection: (c: HubConnection | null) => void;

  // Real-time event feed
  events: RealtimeEvent[];
  addEvent: (event: RealtimeEvent) => void;
  clearEvents: () => void;

  // Selected planet for detail view
  selectedPlanetId: string | null;
  setSelectedPlanetId: (id: string | null) => void;

  // Mobile navigation drawer
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  toggleMobileNav: () => void;

  // Graphics settings
  graphicsQuality: GraphicsQuality;
  setGraphicsQuality: (quality: GraphicsQuality) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isConnected: false,
  setConnected: (v) => set({ isConnected: v }),
  connection: null,
  setConnection: (c) => set({ connection: c }),

  events: [],
  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, 50),
    })),
  clearEvents: () => set({ events: [] }),

  selectedPlanetId: null,
  setSelectedPlanetId: (id) => set({ selectedPlanetId: id }),

  mobileNavOpen: false,
  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
  toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),

  graphicsQuality: detectInitialQuality(),
  setGraphicsQuality: (q) => set({ graphicsQuality: q }),
}));
