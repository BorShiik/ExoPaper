import * as THREE from "three";

/**
 * Approximate black-body color for a given stellar effective temperature (Kelvin).
 * Based on Tanner Helland's well-known approximation, clamped to a sane stellar
 * range. Returns a THREE.Color already interpreted from sRGB, so it can be used
 * directly for lights and (sRGB) materials under three's color management.
 *
 *   ~3000K → red/orange   ~5800K → warm white (Sun)   ~10000K+ → blue-white
 */
export function kelvinToColor(kelvinInput: number | null | undefined): THREE.Color {
  const kelvin = Math.min(40000, Math.max(1000, kelvinInput ?? 5800));
  const temp = kelvin / 100;

  let r: number;
  let g: number;
  let b: number;

  if (temp <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
  }

  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  }

  const norm = (x: number) => Math.min(255, Math.max(0, x)) / 255;

  const color = new THREE.Color();
  color.setRGB(norm(r), norm(g), norm(b), THREE.SRGBColorSpace);
  return color;
}

/**
 * Deterministic 32-bit hash (FNV-1a) from a string — used to seed procedural
 * generation so meshes stay stable across React 19 Strict Mode double-renders.
 */
export function hashStringToSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
