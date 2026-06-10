import * as THREE from "three";
import { pickPalette } from "./proceduralPlanet";

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const PLANET_FRAG = /* glsl */ `
  uniform float uSeed;
  uniform vec3 uSeedOffset;
  uniform bool uGaseous;
  uniform vec3 uColorLow;
  uniform vec3 uColorMid;
  uniform vec3 uColorHigh;
  uniform int uMode; // 0=Albedo, 1=Normal, 2=Roughness
  
  varying vec2 vUv;

  #define PI 3.14159265359

  // ─── Hash & Noise ──────────────────────────────────────────────────────────
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  
  float fbm(vec3 p, int octaves) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      s += a * vnoise(p); p *= 2.02; a *= 0.5;
    }
    return s;
  }
  
  float ridged(vec3 p, int octaves) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      float n = vnoise(p);
      n = 1.0 - abs(2.0 * n - 1.0);
      n *= n;
      s += a * n; a *= 0.5; p *= 2.02;
    }
    return s;
  }

  // ─── Procedural Planet Height ─────────────────────────────────────────────
  
  vec3 getCartesian(vec2 uv) {
    float lon = uv.x * PI * 2.0;
    float lat = (uv.y - 0.5) * PI;
    float cosLat = cos(lat);
    return vec3(cosLat * cos(lon), sin(lat), cosLat * sin(lon));
  }
  
  float getHeight(vec2 uv) {
    vec3 pos = getCartesian(uv);
    vec3 seedPos = pos + uSeedOffset;
    
    // Domain warp
    float wfreq = 1.3;
    float wx = fbm(seedPos * wfreq + vec3(13.1, 7.7, 3.3), 2);
    float wy = fbm(seedPos * wfreq + vec3(5.2, 19.4, 11.9), 2);
    float wz = fbm(seedPos * wfreq + vec3(27.3, 2.8, 23.6), 2);
    vec3 sPos = seedPos + (vec3(wx, wy, wz) - 0.5) * 0.55;
    
    float h = 0.0;
    if (uGaseous) {
      float flow = fbm(sPos * vec3(2.0, 1.0, 2.0), 4);
      float lat = (uv.y - 0.5) * PI;
      float bands = 7.0 + mod(uSeed, 7.0);
      float band = sin(lat * bands + flow * 7.0);
      float storms = fbm(sPos * 5.0, 3);
      h = clamp(0.5 + band * 0.3 + (storms - 0.5) * 0.18, 0.0, 1.0);
    } else {
      float freq = 2.6;
      float base = fbm(sPos * freq, 6);
      float r = ridged(sPos * freq * 1.4, 4);
      float detail = fbm(sPos * freq * 4.0, 3);
      h = base * 0.5 + r * 0.4 + (detail - 0.5) * 0.18;
      h = clamp((h - 0.5) * 1.3 + 0.5, 0.0, 1.0);
    }
    return h;
  }

  // ─── Main ─────────────────────────────────────────────────────────────────
  
  void main() {
    float h = getHeight(vUv);
    float lat = (vUv.y - 0.5) * PI;
    float polar = max(0.0, (abs(lat) - 1.05) / (PI / 2.0 - 1.05));
    
    if (uMode == 0) {
      // Albedo
      vec3 col = h < 0.5 
        ? mix(uColorLow, uColorMid, h / 0.5)
        : mix(uColorMid, uColorHigh, (h - 0.5) / 0.5);
        
      if (!uGaseous && polar > 0.0 && h > 0.42) {
        vec3 ICE = vec3(232.0, 238.0, 247.0) / 255.0;
        col = mix(col, ICE, min(1.0, polar * 1.25));
      }
      gl_FragColor = vec4(col, 1.0);
      
    } else if (uMode == 1) {
      // Normal map
      float epsU = 1.0 / 1024.0;
      float epsV = 1.0 / 512.0;
      
      float hL = getHeight(vec2(fract(vUv.x - epsU), vUv.y));
      float hR = getHeight(vec2(fract(vUv.x + epsU), vUv.y));
      float hD = getHeight(vec2(vUv.x, clamp(vUv.y - epsV, 0.0, 1.0)));
      float hU = getHeight(vec2(vUv.x, clamp(vUv.y + epsV, 0.0, 1.0)));
      
      float strength = uGaseous ? 1.0 : 6.0;
      float dX = (hL - hR) * strength;
      float dY = (hD - hU) * strength;
      vec3 n = normalize(vec3(dX, dY, 1.0));
      gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
      
    } else if (uMode == 2) {
      // Roughness
      float rr = 0.0;
      if (uGaseous) {
        rr = (150.0 + (h - 0.5) * 40.0) / 255.0;
      } else if (h < 0.42) {
        rr = 20.0 / 255.0; // ocean — very smooth → tight, bright specular sun-glint
      } else if (polar > 0.3) {
        rr = 95.0 / 255.0; // ice
      } else {
        rr = (205.0 + (h - 0.5) * 80.0) / 255.0; // land
      }
      rr = clamp(rr, 0.0, 1.0);
      gl_FragColor = vec4(vec3(rr), 1.0);
    } else if (uMode == 3) {
      // Clouds
      vec3 pos = getCartesian(vUv);
      vec3 seedPos = pos + uSeedOffset * 1.2 + vec3(31.7, 19.3, 47.1);
      float flow = fbm(seedPos * 1.5, 3);
      float c = fbm(seedPos * 3.5 + flow, 5);
      c = smoothstep(0.35, 0.65, c);
      gl_FragColor = vec4(vec3(1.0), c);
    } else if (uMode == 4) {
      // Emissive molten map (lava worlds): glowing cracks in the cooled crust.
      float crack = smoothstep(0.52, 0.18, h); // low areas glow hottest
      float veins = ridged((getCartesian(vUv) + uSeedOffset) * 6.0, 3);
      float glowAmt = clamp(crack + (veins - 0.5) * 0.4, 0.0, 1.0);
      vec3 glow = mix(vec3(0.45, 0.04, 0.0), vec3(1.0, 0.72, 0.18), glowAmt);
      gl_FragColor = vec4(glow * glowAmt, 1.0);
    }
  }
`;

let _camera: THREE.OrthographicCamera;
let _scene: THREE.Scene;
let _mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

function initFBO() {
  if (_scene) return;
  _camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  _scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: PLANET_FRAG,
    uniforms: {
      uSeed: { value: 0 },
      uSeedOffset: { value: new THREE.Vector3() },
      uGaseous: { value: false },
      uColorLow: { value: new THREE.Color() },
      uColorMid: { value: new THREE.Color() },
      uColorHigh: { value: new THREE.Color() },
      uMode: { value: 0 },
    },
    depthWrite: false,
    depthTest: false,
  });
  _mesh = new THREE.Mesh(geometry, material);
  _scene.add(_mesh);
}

export interface PlanetTexturesGPU {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  /** Molten-glow map for lava worlds (null otherwise). */
  emissiveMap: THREE.Texture | null;
  dispose: () => void;
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

/** Raw render-target set + its real GPU disposer (owned by the cache). */
interface RawTextures {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  emissiveMap: THREE.Texture | null;
  disposeRaw: () => void;
}

function generateRaw(
  gl: THREE.WebGLRenderer,
  seed: number,
  gaseous: boolean,
  resolution: number,
  eqTempK: number | null | undefined,
  lava: boolean
): RawTextures {
  initFBO();

  const width = resolution;
  const height = resolution / 2;

  const palette = pickPalette(seed, gaseous, eqTempK);
  const toCol = (rgb: [number, number, number]) =>
    new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);

  const rng = mulberry32(seed);
  const offset = new THREE.Vector3(
    (rng() - 0.5) * 1000.0,
    (rng() - 0.5) * 1000.0,
    (rng() - 0.5) * 1000.0
  );

  _mesh.material.uniforms.uSeed.value = seed % 10000;
  _mesh.material.uniforms.uSeedOffset.value.copy(offset);
  _mesh.material.uniforms.uGaseous.value = gaseous;
  _mesh.material.uniforms.uColorLow.value = toCol(palette.low);
  _mesh.material.uniforms.uColorMid.value = toCol(palette.mid);
  _mesh.material.uniforms.uColorHigh.value = toCol(palette.high);

  const createTarget = (colorSpace: THREE.ColorSpace) =>
    new THREE.WebGLRenderTarget(width, height, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      anisotropy: gl.capabilities.getMaxAnisotropy(),
      generateMipmaps: true,
      colorSpace,
    });

  const rtMap = createTarget(THREE.SRGBColorSpace);
  const rtNormal = createTarget(THREE.NoColorSpace);
  const rtRough = createTarget(THREE.NoColorSpace);
  const rtEmissive = lava ? createTarget(THREE.SRGBColorSpace) : null;

  const originalTarget = gl.getRenderTarget();

  const renderMode = (mode: number, rt: THREE.WebGLRenderTarget) => {
    _mesh.material.uniforms.uMode.value = mode;
    gl.setRenderTarget(rt);
    gl.render(_scene, _camera);
  };

  renderMode(0, rtMap);
  renderMode(1, rtNormal);
  renderMode(2, rtRough);
  if (rtEmissive) renderMode(4, rtEmissive);

  gl.setRenderTarget(originalTarget);

  return {
    map: rtMap.texture,
    normalMap: rtNormal.texture,
    roughnessMap: rtRough.texture,
    emissiveMap: rtEmissive ? rtEmissive.texture : null,
    disposeRaw: () => {
      rtMap.dispose();
      rtNormal.dispose();
      rtRough.dispose();
      rtEmissive?.dispose();
    },
  };
}

// ── Ref-counted LRU cache ─────────────────────────────────────────────────
// The FBO render (3–4 full-screen shader passes, expensive normal map) is the
// main source of navigation hitching. We cache the generated targets by their
// generative key and only re-render on a real miss. Entries are never disposed
// while still in use (refs > 0); idle entries are evicted once over capacity.
interface CacheEntry {
  raw: RawTextures;
  refs: number;
  lastUsed: number;
}
const _cache = new Map<string, CacheEntry>();
const CACHE_CAPACITY = 10;
let _clock = 0;

function evictIfNeeded() {
  while (_cache.size > CACHE_CAPACITY) {
    let oldestKey: string | null = null;
    let oldest = Infinity;
    for (const [k, e] of _cache) {
      if (e.refs === 0 && e.lastUsed < oldest) {
        oldest = e.lastUsed;
        oldestKey = k;
      }
    }
    if (oldestKey === null) break; // everything still in use
    _cache.get(oldestKey)!.raw.disposeRaw();
    _cache.delete(oldestKey);
  }
}

export function generatePlanetTexturesGPU(
  gl: THREE.WebGLRenderer,
  seed: number,
  gaseous: boolean,
  resolution: number = 1024,
  eqTempK?: number | null,
  lava: boolean = false
): PlanetTexturesGPU {
  const tempBucket = eqTempK == null ? "x" : Math.round(eqTempK / 100);
  const key = `${seed}|${gaseous ? 1 : 0}|${resolution}|${lava ? 1 : 0}|${tempBucket}`;

  let entry = _cache.get(key);
  if (!entry) {
    entry = { raw: generateRaw(gl, seed, gaseous, resolution, eqTempK, lava), refs: 0, lastUsed: _clock };
    _cache.set(key, entry);
  }
  entry.refs++;
  entry.lastUsed = ++_clock;
  evictIfNeeded();

  let released = false;
  return {
    map: entry.raw.map,
    normalMap: entry.raw.normalMap,
    roughnessMap: entry.raw.roughnessMap,
    emissiveMap: entry.raw.emissiveMap,
    // Release this acquisition; GPU memory is freed later by LRU eviction.
    dispose: () => {
      if (released) return;
      released = true;
      const e = _cache.get(key);
      if (e) {
        e.refs = Math.max(0, e.refs - 1);
        e.lastUsed = ++_clock;
      }
    },
  };
}

export function generateCloudTextureGPU(
  gl: THREE.WebGLRenderer,
  seed: number,
  resolution: number = 1024
): THREE.Texture {
  initFBO();

  const rng = mulberry32(seed);
  const offset = new THREE.Vector3(
    (rng() - 0.5) * 1000.0,
    (rng() - 0.5) * 1000.0,
    (rng() - 0.5) * 1000.0
  );

  _mesh.material.uniforms.uSeed.value = seed % 10000;
  _mesh.material.uniforms.uSeedOffset.value.copy(offset);
  _mesh.material.uniforms.uMode.value = 3;

  const rtClouds = new THREE.WebGLRenderTarget(resolution, resolution / 2, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    anisotropy: gl.capabilities.getMaxAnisotropy(),
    generateMipmaps: true,
  });

  const originalTarget = gl.getRenderTarget();
  gl.setRenderTarget(rtClouds);
  gl.render(_scene, _camera);
  gl.setRenderTarget(originalTarget);

  const texture = rtClouds.texture;
  const originalDispose = texture.dispose.bind(texture);
  texture.dispose = () => {
    originalDispose();
    rtClouds.dispose();
  };

  return texture;
}
