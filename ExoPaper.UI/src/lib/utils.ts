import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TranslationKey } from "../i18n/translations";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const METHOD_KEYS: Record<string, TranslationKey> = {
  Transit: "method.transit",
  "Radial Velocity": "method.radialVelocity",
  Microlensing: "method.microlensing",
  Imaging: "method.directImaging",
  "Transit Timing Variations": "method.ttv",
  "Eclipse Timing Variations": "method.eclipseTiming",
  "Orbital Brightness Modulation": "method.orbitalBrightness",
  "Pulsar Timing": "method.pulsarTiming",
  Astrometry: "method.astrometry",
  "Pulsation Timing Variations": "method.pulsationTiming",
  "Disk Kinematics": "method.diskKinematics",
};

export function methodLabel(
  method: string | null | undefined,
  t: (key: TranslationKey) => string,
  fallback: string
): string {
  if (!method) return fallback;
  const key = METHOD_KEYS[method];
  return key ? t(key) : method;
}

/** Extracts the short name from a RavenDB document ID. */
export function shortId(fullId: string): string {
  const parts = fullId.split("/");
  return parts[parts.length - 1];
}

/** Formats a nullable number with specified decimals, returns "N/A" if null. */
export function formatValue(
  value: number | null | undefined,
  decimals = 4,
  unit = ""
): string {
  if (value == null) return "N/A";
  return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

/** Maps stellar effective temperature (K) to a CSS color. */
export function starColorFromTemperature(tempK: number | null | undefined): string {
  if (tempK == null) return "hsl(45, 80%, 75%)";
  if (tempK < 3500) return "hsl(0, 75%, 55%)";
  if (tempK < 5200) return "hsl(25, 90%, 60%)";
  if (tempK < 6000) return "hsl(45, 95%, 70%)";
  if (tempK < 7500) return "hsl(55, 70%, 85%)";
  return "hsl(210, 80%, 75%)";
}

/** Maps stellar temperature to a Three.js-compatible hex color. */
export function starColorHex(tempK: number | null | undefined): number {
  if (tempK == null) return 0xfff4e0;
  if (tempK < 3500) return 0xff4422;
  if (tempK < 5200) return 0xff8833;
  if (tempK < 6000) return 0xffee66;
  if (tempK < 7500) return 0xfff8ee;
  return 0x88bbff;
}

// ── Unit conversions ─────────────────────────────────────────────────────
const EARTH_MASSES_PER_JUPITER = 317.828;
const EARTH_RADII_PER_JUPITER = 11.209;
const LIGHT_YEARS_PER_PARSEC = 3.26156;

export const toJupiterMass = (earthMass: number) => earthMass / EARTH_MASSES_PER_JUPITER;
export const toJupiterRadius = (earthRadius: number) => earthRadius / EARTH_RADII_PER_JUPITER;
export const parsecsToLightYears = (pc: number) => pc * LIGHT_YEARS_PER_PARSEC;
export const kelvinToCelsius = (k: number) => k - 273.15;

/** Compact number formatting (e.g. 5085.28 → "5,085", 0.0123 → "0.012"). */
export function compactNumber(value: number, maxDecimals = 2): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return Math.round(value).toLocaleString();
  if (abs >= 1) return Number(value.toFixed(maxDecimals)).toLocaleString();
  return Number(value.toFixed(maxDecimals + 1)).toString();
}

/** Classifies a planet by radius (preferred) or mass into a display type + color. */
export function classifyPlanet(
  massEarth?: number | null,
  radiusEarth?: number | null
): { key: TranslationKey; color: string } | null {
  if (radiusEarth != null) {
    if (radiusEarth < 1.25) return { key: "type.terrestrial", color: "#A3BE8C" };
    if (radiusEarth < 2) return { key: "type.superEarth", color: "#8FBCBB" };
    if (radiusEarth < 4) return { key: "type.subNeptune", color: "#88C0D0" };
    if (radiusEarth < 6) return { key: "type.neptunelike", color: "#81A1C1" };
    return { key: "type.gasGiant", color: "#EBCB8B" };
  }
  if (massEarth != null) {
    if (massEarth < 2) return { key: "type.terrestrial", color: "#A3BE8C" };
    if (massEarth < 10) return { key: "type.superEarth", color: "#8FBCBB" };
    if (massEarth < 50) return { key: "type.neptunelike", color: "#81A1C1" };
    return { key: "type.gasGiant", color: "#EBCB8B" };
  }
  return null;
}

/** arXiv preprints use the tail of the document id without the collection prefix. */
export function extractArxivId(paperId: string): string {
  return paperId.replace(/^papers\//i, "");
}

/** Builds a valid arXiv abstract URL. */
export function arxivUrl(paperId: string): string {
  const raw = extractArxivId(paperId);
  if (raw.includes("/") || raw.includes(".")) return `https://arxiv.org/abs/${raw}`;
  if (/^\d{7}$/.test(raw)) return `https://arxiv.org/abs/astro-ph/${raw}`;
  return `https://arxiv.org/abs/${raw}`;
}
