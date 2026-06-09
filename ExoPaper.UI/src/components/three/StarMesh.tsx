import { useEffect, useMemo, useRef } from "react";
import { useFrame, extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import * as THREE from "three";
import { kelvinToColor } from "./stellar";

interface Props {
  temperature: number | null | undefined;
  /** Stellar jitter — subtle pulsation (e.g. for Radial Velocity hosts). */
  jitter?: boolean;
  radius?: number;
  /** Point-light intensity (physical, decay = 2). */
  lightIntensity?: number;
  position?: [number, number, number];
}

const SURFACE_VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vObjPos;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  float hash(vec3 p){
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  
  float noise(vec3 x){
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    vObjPos = position;
    // Slower animation, slightly larger displacement to break the perfect sphere
    vec3 noiseCoord = position * 2.0 + vec3(0.0, uTime * 0.4, 0.0);
    float disp = noise(noiseCoord) * 0.12; 
    
    vec3 displaced = position + normal * disp;
    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vPositionW = worldPos.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// Granulation (convection cells) + sunspots + limb darkening, evolving slowly.
const SURFACE_FRAG = /* glsl */ `
  uniform float uTemperature;
  uniform float uTime;
  varying vec3 vObjPos;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  vec3 kelvinToRGB(float kelvin) {
    float temp = clamp(kelvin, 1000.0, 40000.0) / 100.0;
    float r = 0.0, g = 0.0, b = 0.0;

    if (temp <= 66.0) {
        r = 1.0;
        g = clamp((99.4708025861 * log(temp) - 161.1195681661) / 255.0, 0.0, 1.0);
    } else {
        r = clamp((329.698727446 * pow(temp - 60.0, -0.1332047592)) / 255.0, 0.0, 1.0);
        g = clamp((288.1221695283 * pow(temp - 60.0, -0.0755148492)) / 255.0, 0.0, 1.0);
    }

    if (temp >= 66.0) {
        b = 1.0;
    } else if (temp <= 19.0) {
        b = 0.0;
    } else {
        b = clamp((138.5177312231 * log(temp - 10.0) - 305.0447927307) / 255.0, 0.0, 1.0);
    }

    return vec3(r, g, b);
  }

  float hash(vec3 p){
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  
  float vnoise(vec3 x){
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  
  float fbm(vec3 p){
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.02; a *= 0.5; }
    return s;
  }

  void main(){
    vec3 viewDir = normalize(cameraPosition - vPositionW);
    float ndv = clamp(dot(normalize(vNormalW), viewDir), 0.0, 1.0);
    float limb = pow(ndv, 0.7); // stronger limb darkening

    // Slower convection filaments
    vec3 p1 = vObjPos * 3.5 + vec3(0.0, uTime * 0.1, 0.0);
    float wX = fbm(p1 + vec3(11.3, 7.7, 3.1));
    float wY = fbm(p1 + vec3(5.2, 13.9, 8.4));
    float wZ = fbm(p1 + vec3(2.1, 4.3, 15.6));
    
    vec3 warpedPos = p1 + vec3(wX, wY, wZ) * 1.2;
    float plasma = fbm(warpedPos);
    
    // Detailed granulation (slower)
    float detail = fbm(vObjPos * 10.0 - vec3(0.0, uTime * 0.15, 0.0));
    float finalNoise = mix(plasma, detail, 0.4);

    // Sunspots (cool magnetic spots), moving slowly
    float spotsNoise = fbm(vObjPos * 2.0 + vec3(0.0, uTime * 0.05, 0.0));
    float spot = smoothstep(0.45, 0.25, spotsNoise);

    vec3 baseColor = kelvinToRGB(uTemperature);
    vec3 glowColor = kelvinToRGB(uTemperature + 1500.0);
    
    // Specific custom color maps for a dramatic, realistic look
    if (uTemperature > 9000.0) {
        baseColor = vec3(0.0, 0.15, 0.8);
        glowColor = vec3(0.3, 0.8, 1.0);
    } else if (uTemperature >= 5000.0 && uTemperature <= 6800.0) {
        // Deep fiery orange base, bright yellow-gold plasma cracks
        baseColor = vec3(0.7, 0.15, 0.0);
        glowColor = vec3(1.0, 0.7, 0.1);
    } else if (uTemperature < 5000.0) {
        baseColor = vec3(0.4, 0.01, 0.0);
        glowColor = vec3(0.9, 0.25, 0.05);
    }
    
    // High contrast plasma pattern
    vec3 col = mix(baseColor, glowColor, pow(finalNoise, 1.5));
    
    // Add white-hot granulation peaks (clamped to avoid sudden HDR bloom flickering)
    float clampedNoise = clamp(finalNoise, 0.0, 1.0);
    vec3 hotGranulation = vec3(1.0, 0.9, 0.8) * pow(clampedNoise, 3.0) * glowColor;
    col += hotGranulation * 0.6;
    
    // Apply sunspots deeply
    col = mix(col, baseColor * 0.05, spot * 0.95);
    
    // Apply limb darkening (darker edges)
    col *= (0.1 + 0.9 * limb);

    // Boosted multiplier to 2.5 so the core HDR color aggressively breaks the bloom threshold
    gl_FragColor = vec4(col * 2.5, 1.0);
  }
`;

const CORONA_VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  float hash(vec3 p){
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  
  float noise(vec3 x){
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    // Warp the corona outline dynamically to match the boiling star body (slower)
    vec3 noiseCoord = position * 2.0 + vec3(0.0, uTime * 0.3, 0.0);
    float disp = noise(noiseCoord) * 0.15;
    
    vec3 displaced = position + normal * disp;
    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vPositionW = worldPos.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const CORONA_FRAG = /* glsl */ `
  uniform float uTemperature;
  uniform float uTime;
  uniform float uFalloff;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  vec3 kelvinToRGB(float kelvin) {
    float temp = clamp(kelvin, 1000.0, 40000.0) / 100.0;
    float r = 0.0, g = 0.0, b = 0.0;

    if (temp <= 66.0) {
        r = 1.0;
        g = clamp((99.4708025861 * log(temp) - 161.1195681661) / 255.0, 0.0, 1.0);
    } else {
        r = clamp((329.698727446 * pow(temp - 60.0, -0.1332047592)) / 255.0, 0.0, 1.0);
        g = clamp((288.1221695283 * pow(temp - 60.0, -0.0755148492)) / 255.0, 0.0, 1.0);
    }

    if (temp >= 66.0) {
        b = 1.0;
    } else if (temp <= 19.0) {
        b = 0.0;
    } else {
        b = clamp((138.5177312231 * log(temp - 10.0) - 305.0447927307) / 255.0, 0.0, 1.0);
    }

    return vec3(r, g, b);
  }

  void main() {
    vec3 baseColor = kelvinToRGB(uTemperature);
    if (uTemperature > 9000.0) {
        baseColor = vec3(0.08, 0.4, 1.0);
    } else if (uTemperature >= 5000.0 && uTemperature <= 6800.0) {
        baseColor = vec3(1.0, 0.4, 0.05);
    } else if (uTemperature < 5000.0) {
        baseColor = vec3(0.9, 0.1, 0.02);
    }

    vec3 viewDir = normalize(cameraPosition - vPositionW);
    float NdotV = clamp(dot(normalize(vNormalW), viewDir), 0.0, 1.0);

    // Smooth volumetric corona: brightest where the line of sight passes
    // straight through the shell (over the disc) and dissolving completely to
    // 0 at the silhouette, so the glow melts into pitch-black space with no
    // hard "soap-bubble" rim. uFalloff controls how tightly it hugs the core.
    float fres = pow(NdotV, uFalloff);
    float pulse = 0.92 + 0.08 * sin(uTime * 0.6);
    float intensity = fres * pulse;

    gl_FragColor = vec4(baseColor * 2.2, intensity);
  }
`;

const StarSurfaceMaterial = shaderMaterial(
  {
    uTemperature: 5800.0,
    uTime: 0.0,
  },
  SURFACE_VERT,
  SURFACE_FRAG
);

const StarCoronaMaterial = shaderMaterial(
  {
    uTemperature: 5800.0,
    uTime: 0.0,
    uFalloff: 3.0,
  },
  CORONA_VERT,
  CORONA_FRAG
);

extend({ StarSurfaceMaterial, StarCoronaMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    starSurfaceMaterial: any;
    starCoronaMaterial: any;
  }
}

export default function StarMesh({
  temperature,
  jitter = false,
  radius = 1.4,
  lightIntensity = 800,
  position,
}: Props) {
  const coreRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);
  const surfMatRef = useRef<any>(null);
  const coronaMatRef = useRef<any>(null);
  const coronaMat2Ref = useRef<any>(null);

  const color = useMemo(() => kelvinToColor(temperature), [temperature]);

  const coreGeometry = useMemo(() => new THREE.SphereGeometry(radius, 48, 48), [radius]);
  const coronaGeometry = useMemo(() => new THREE.SphereGeometry(radius, 32, 32), [radius]);

  useEffect(() => {
    return () => {
      coreGeometry.dispose();
      coronaGeometry.dispose();
    };
  }, [coreGeometry, coronaGeometry]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const tempVal = temperature ?? 5800.0;

    if (surfMatRef.current) {
      surfMatRef.current.uTime = t;
      surfMatRef.current.uTemperature = tempVal;
    }
    if (coronaMatRef.current) {
      coronaMatRef.current.uTime = t;
      coronaMatRef.current.uTemperature = tempVal;
    }
    if (coronaMat2Ref.current) {
      coronaMat2Ref.current.uTime = t * 0.7;
      coronaMat2Ref.current.uTemperature = tempVal;
    }

    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.035;
      // Much slower, majestic breathing pulsation instead of rapid jitter
      coreRef.current.scale.setScalar(jitter ? 1.0 + Math.sin(t * 0.15) * 0.008 : 1.0);
    }
    if (lightRef.current) {
      lightRef.current.intensity = jitter
        ? lightIntensity * (1.0 + Math.sin(t * 0.7) * 0.03)
        : lightIntensity;
    }
  });

  return (
    <group position={position}>
      <pointLight
        ref={lightRef}
        color={color}
        intensity={lightIntensity}
        distance={0}
        decay={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />

      <mesh ref={coreRef} geometry={coreGeometry}>
        <starSurfaceMaterial
          ref={surfMatRef}
          uTemperature={temperature ?? 5800.0}
          uTime={0}
        />
      </mesh>

      {/* Inner corona — tight, bright, hugs the photosphere. */}
      <mesh scale={1.25} geometry={coronaGeometry}>
        <starCoronaMaterial
          ref={coronaMatRef}
          uTemperature={temperature ?? 5800.0}
          uTime={0}
          uFalloff={3.4}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Outer corona — large, soft, low-falloff halo that fades into space. */}
      <mesh scale={2.1} geometry={coronaGeometry}>
        <starCoronaMaterial
          ref={coronaMat2Ref}
          uTemperature={temperature ?? 5800.0}
          uTime={0}
          uFalloff={1.7}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
