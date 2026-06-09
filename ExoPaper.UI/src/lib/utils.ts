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
  "Direct Imaging": "method.directImaging",
  "Transit Timing Variations": "method.ttv",
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
