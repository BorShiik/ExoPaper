import * as THREE from "three";

// ──────────────────────────────────────────────────────────────────────────
//  Deterministic procedural planet textures (albedo + roughness + normal).
//  Sampled as seamless 3D value-noise on the sphere surface (no equirect seam),
//  with domain warping + ridged multifractal terrain for crisp, organic detail.
//  Fully seeded — no Math.random at runtime.
// ──────────────────────────────────────────────────────────────────────────

type RGB = [number, number, number]; // sRGB, 0..255

export interface PlanetTextureOptions {
  seed: number;
  gaseous: boolean;
  colorLow: RGB;
  colorMid: RGB;
  colorHigh: RGB;
  width?: number;
  height?: number;
}

export interface PlanetTextures {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  dispose(): void;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPermutation(seed: number): Uint8Array {
  const rng = mulberry32(seed || 1);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  return p;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function hashVal(p: Uint8Array, xi: number, yi: number, zi: number) {
  return p[(p[(p[xi & 255] + yi) & 255] + zi) & 255] / 255;
}

function valueNoise3(p: Uint8Array, x: number, y: number, z: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = fade(xf);
  const v = fade(yf);
  const w = fade(zf);

  const c000 = hashVal(p, xi, yi, zi);
  const c100 = hashVal(p, xi + 1, yi, zi);
  const c010 = hashVal(p, xi, yi + 1, zi);
  const c110 = hashVal(p, xi + 1, yi + 1, zi);
  const c001 = hashVal(p, xi, yi, zi + 1);
  const c101 = hashVal(p, xi + 1, yi, zi + 1);
  const c011 = hashVal(p, xi, yi + 1, zi + 1);
  const c111 = hashVal(p, xi + 1, yi + 1, zi + 1);

  const x00 = lerp(c000, c100, u);
  const x10 = lerp(c010, c110, u);
  const x01 = lerp(c001, c101, u);
  const x11 = lerp(c011, c111, u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

function fbm(p: Uint8Array, x: number, y: number, z: number, octaves: number) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise3(p, x * freq, y * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Ridged multifractal — sharp mountain ridges (0..1). */
function ridged(p: Uint8Array, x: number, y: number, z: number, octaves: number) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    let n = valueNoise3(p, x * freq, y * freq, z * freq);
    n = 1 - Math.abs(2 * n - 1);
    n *= n;
    sum += amp * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

const lerp3 = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const ICE: RGB = [232, 238, 247];

export function generatePlanetTextures(opts: PlanetTextureOptions): PlanetTextures {
  const width = opts.width ?? 512;
  const height = opts.height ?? 256;
  const p = buildPermutation(opts.seed);

  const makeCanvas = () => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return c;
  };

  const albedo = makeCanvas();
  const rough = makeCanvas();
  const normal = makeCanvas();
  const aCtx = albedo.getContext("2d")!;
  const rCtx = rough.getContext("2d")!;
  const nCtx = normal.getContext("2d")!;
  const aImg = aCtx.createImageData(width, height);
  const rImg = rCtx.createImageData(width, height);
  const nImg = nCtx.createImageData(width, height);

  const heights = new Float32Array(width * height);
  const bands = 7 + (opts.seed % 7);
  const freq = 2.6;

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const lat = (v - 0.5) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const polar = Math.max(0, (Math.abs(lat) - 1.05) / (Math.PI / 2 - 1.05));

    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const lon = u * Math.PI * 2;
      const dx = cosLat * Math.cos(lon);
      const dy = sinLat;
      const dz = cosLat * Math.sin(lon);

      // Domain warp for organic, non-repetitive features.
      const wfreq = 1.3;
      const wx = fbm(p, dx * wfreq + 13.1, dy * wfreq + 7.7, dz * wfreq + 3.3, 2);
      const wy = fbm(p, dx * wfreq + 5.2, dy * wfreq + 19.4, dz * wfreq + 11.9, 2);
      const wz = fbm(p, dx * wfreq + 27.3, dy * wfreq + 2.8, dz * wfreq + 23.6, 2);
      const warp = 0.55;
      const sx = dx + (wx - 0.5) * warp;
      const sy = dy + (wy - 0.5) * warp;
      const sz = dz + (wz - 0.5) * warp;

      let h: number;
      if (opts.gaseous) {
        const flow = fbm(p, sx * 2.0, sy * 1.0, sz * 2.0, 4);
        const band = Math.sin(lat * bands + flow * 7.0);
        const storms = fbm(p, sx * 5.0, sy * 5.0, sz * 5.0, 3);
        h = clamp01(0.5 + band * 0.3 + (storms - 0.5) * 0.18);
      } else {
        const base = fbm(p, sx * freq, sy * freq, sz * freq, 6);
        const r = ridged(p, sx * freq * 1.4, sy * freq * 1.4, sz * freq * 1.4, 4);
        const detail = fbm(p, sx * freq * 4.0, sy * freq * 4.0, sz * freq * 4.0, 3);
        h = base * 0.5 + r * 0.4 + (detail - 0.5) * 0.18;
        h = clamp01((h - 0.5) * 1.3 + 0.5); // boost contrast
      }
      heights[y * width + x] = h;

      // ── Albedo ──
      let col: RGB =
        h < 0.5
          ? lerp3(opts.colorLow, opts.colorMid, h / 0.5)
          : lerp3(opts.colorMid, opts.colorHigh, (h - 0.5) / 0.5);

      if (!opts.gaseous && polar > 0 && h > 0.42) {
        col = lerp3(col, ICE, Math.min(1, polar * 1.25));
      }

      const i = (y * width + x) * 4;
      aImg.data[i] = col[0];
      aImg.data[i + 1] = col[1];
      aImg.data[i + 2] = col[2];
      aImg.data[i + 3] = 255;

      // ── Roughness ──
      let rr: number;
      if (opts.gaseous) {
        rr = 150 + (h - 0.5) * 40;
      } else if (h < 0.42) {
        rr = 45; // smooth oceans → crisp specular sun-glint
      } else if (polar > 0.3) {
        rr = 95; // icy
      } else {
        rr = 205 + (h - 0.5) * 80; // rough terrain
      }
      rr = Math.min(255, Math.max(0, rr));
      rImg.data[i] = rr;
      rImg.data[i + 1] = rr;
      rImg.data[i + 2] = rr;
      rImg.data[i + 3] = 255;
    }
  }

  // Tangent-space normal map from the height field (U wraps, V clamps).
  const strength = opts.gaseous ? 0.9 : 3.2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const xl = (x - 1 + width) % width;
      const xr = (x + 1) % width;
      const yu = Math.max(0, y - 1);
      const yd = Math.min(height - 1, y + 1);

      const dXv = (heights[y * width + xl] - heights[y * width + xr]) * strength;
      const dYv = (heights[yu * width + x] - heights[yd * width + x]) * strength;
      const nz = 1.0;
      const inv = 1 / Math.sqrt(dXv * dXv + dYv * dYv + nz * nz);

      const i = (y * width + x) * 4;
      nImg.data[i] = Math.floor((dXv * inv * 0.5 + 0.5) * 255);
      nImg.data[i + 1] = Math.floor((dYv * inv * 0.5 + 0.5) * 255);
      nImg.data[i + 2] = Math.floor((nz * inv * 0.5 + 0.5) * 255);
      nImg.data[i + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(normal);
  normalMap.colorSpace = THREE.NoColorSpace;
  const roughnessMap = new THREE.CanvasTexture(rough);
  roughnessMap.colorSpace = THREE.NoColorSpace;

  for (const t of [map, normalMap, roughnessMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 8;
    t.needsUpdate = true;
  }

  return {
    map,
    normalMap,
    roughnessMap,
    dispose() {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}

// ── Palettes ────────────────────────────────────────────────────────────────

const ROCKY_PALETTES: { low: RGB; mid: RGB; high: RGB }[] = [
  { low: [18, 46, 86], mid: [104, 86, 58], high: [212, 206, 192] }, // earth-like
  { low: [70, 26, 16], mid: [158, 72, 42], high: [224, 168, 120] }, // mars-like
  { low: [28, 30, 38], mid: [98, 100, 110], high: [206, 208, 214] }, // grey rock
  { low: [22, 44, 36], mid: [78, 116, 72], high: [206, 224, 188] }, // verdant
];

const GAS_PALETTES: { low: RGB; mid: RGB; high: RGB }[] = [
  { low: [104, 66, 38], mid: [196, 152, 102], high: [246, 226, 196] }, // jupiter
  { low: [142, 122, 70], mid: [208, 192, 134], high: [250, 244, 218] }, // saturn
  { low: [28, 78, 130], mid: [78, 150, 196], high: [196, 232, 244] }, // neptune
  { low: [48, 124, 124], mid: [120, 196, 190], high: [214, 244, 238] }, // uranus
];

export function pickPalette(seed: number, gaseous: boolean) {
  const table = gaseous ? GAS_PALETTES : ROCKY_PALETTES;
  return table[seed % table.length];
}
