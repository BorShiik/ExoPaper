import * as THREE from "three";

/**
 * Animated gas-giant surface built on top of MeshStandardMaterial via
 * `onBeforeCompile`. We keep full PBR lighting (so the star's day/night
 * terminator and shadows still work) but replace the diffuse albedo with a
 * procedural, time-evolving atmosphere:
 *
 *   • Fractional Brownian Motion (FBM) → horizontal zonal banding (Jupiter-like)
 *   • domain-warped turbulence          → swirling storms / festoons
 *   • a seeded "great spot"              → a slowly drifting cyclonic storm
 *   • a Fresnel rim added to emissive    → thick-atmosphere limb scattering
 *
 * The whole thing animates from a single `uTime` uniform driven by the render
 * loop. Each instance gets a unique program cache key so its custom uniforms
 * never bleed across materials (the classic onBeforeCompile sharing pitfall).
 */

export interface GasGiantHandle {
  material: THREE.MeshStandardMaterial;
  uniforms: { uTime: { value: number } };
}

/** Deterministic PRNG (mulberry32) so palettes are stable across Strict Mode. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GAS_HEADER = /* glsl */ `
  varying vec3 vGasPos;
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec3 uStorm;
  uniform float uSeed;
  uniform float uBands;

  float gg_hash(vec3 p){
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float gg_noise(vec3 x){
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(gg_hash(i + vec3(0,0,0)), gg_hash(i + vec3(1,0,0)), f.x),
                   mix(gg_hash(i + vec3(0,1,0)), gg_hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(gg_hash(i + vec3(0,0,1)), gg_hash(i + vec3(1,0,1)), f.x),
                   mix(gg_hash(i + vec3(0,1,1)), gg_hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float gg_fbm(vec3 p){
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ s += a * gg_noise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
`;

// Replaces <map_fragment>; diffuseColor (vec4) is already declared above it.
const GAS_DIFFUSE = /* glsl */ `
  {
    vec3 n = normalize(vGasPos);

    // Turbulence drifts slowly in longitude; bands run along latitude (n.y).
    float turb = gg_fbm(n * 2.2 + vec3(uTime * 0.03, 0.0, uSeed * 10.0));
    float swirl = gg_fbm(n * 4.6 + vec3(uTime * 0.06, turb * 1.6, uSeed * 4.0));
    float band = n.y * uBands + turb * 2.3 + swirl * 0.6;
    float t = smoothstep(0.15, 0.85, 0.5 + 0.5 * sin(band));

    vec3 gas = mix(uColorA, uColorB, t);
    // Bright zonal streaks where the band peaks.
    gas += uColorB * pow(t, 3.0) * 0.25;

    // Seeded great storm — a drifting cyclonic spot.
    vec3 spotDir = normalize(vec3(sin(uSeed * 6.2831), -0.25 + uSeed * 0.5, cos(uSeed * 6.2831)));
    float sp = dot(n, spotDir) + gg_fbm(n * 6.0 + uTime * 0.04) * 0.05;
    float spot = smoothstep(0.90, 0.985, sp);
    gas = mix(gas, uStorm, spot * 0.75);

    diffuseColor.rgb = gas;
  }
`;

// Appended after <emissivemap_fragment>; `normal` (view space) and
// `vViewPosition` are both available at this point in the standard shader.
const GAS_RIM = /* glsl */ `
  {
    float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 5.5);
    totalEmissiveRadiance += uColorC * fres * 0.22;
  }
`;

export function createGasGiantMaterial(seed: number, eqTempK?: number | null): GasGiantHandle {
  const rand = mulberry32(seed || 1);
  const hue = rand();

  // Base hue shifts with equilibrium temperature so giants read physically:
  // hot-Jupiter (reddish-brown) → temperate Jovian (tan) → cold ice giant (cyan).
  let beltH = 0.06, zoneH = 0.10, rimH = 0.55, stormH = 0.02, sat = 0.55;
  if (eqTempK != null) {
    if (eqTempK >= 1000) {
      beltH = 0.015; zoneH = 0.05; rimH = 0.06; stormH = 0.0; sat = 0.7; // molten reddish
    } else if (eqTempK <= 150) {
      beltH = 0.55; zoneH = 0.52; rimH = 0.5; stormH = 0.58; sat = 0.5; // neptune cyan-blue
    }
  }

  // Hue-jittered per seed for variety within the temperature class.
  const colorA = new THREE.Color().setHSL((beltH + hue * 0.06) % 1, sat, 0.40); // deep belt
  const colorB = new THREE.Color().setHSL((zoneH + hue * 0.06) % 1, sat * 0.85, 0.74); // bright zone
  const colorC = new THREE.Color().setHSL((rimH + hue * 0.1) % 1, 0.55, 0.62); // atmosphere rim
  const storm = new THREE.Color().setHSL((stormH + hue * 0.05) % 1, 0.70, 0.48); // great spot

  const uniforms = {
    uTime: { value: 0 },
    uColorA: { value: colorA },
    uColorB: { value: colorB },
    uColorC: { value: colorC },
    uStorm: { value: storm },
    uSeed: { value: (Math.abs(seed) % 1000) / 1000 },
    uBands: { value: 7.0 + Math.floor(rand() * 7) },
  };

  const material = new THREE.MeshStandardMaterial({ roughness: 1.0, metalness: 0.0 });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGasPos;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  vGasPos = normalize(position);"
      );

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + GAS_HEADER)
      .replace("#include <map_fragment>", GAS_DIFFUSE)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + GAS_RIM);
  };

  // Unique key per instance → custom uniforms never bleed across materials.
  material.customProgramCacheKey = () => "exo-gas-" + seed;

  return { material, uniforms };
}
