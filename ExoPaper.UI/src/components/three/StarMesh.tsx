import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
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
  varying vec3 vObjPos;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vObjPos = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vPositionW = worldPos.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// Granulation (convection cells) + sunspots + limb darkening, evolving slowly.
const SURFACE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec3 vObjPos;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

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
    float limb = pow(ndv, 0.45); // limb darkening

    // Domain warping for solar convection filaments
    vec3 p1 = vObjPos * 3.5 + vec3(0.0, uTime * 0.05, 0.0);
    float wX = fbm(p1 + vec3(11.3, 7.7, 3.1));
    float wY = fbm(p1 + vec3(5.2, 13.9, 8.4));
    float wZ = fbm(p1 + vec3(2.1, 4.3, 15.6));
    
    vec3 warpedPos = p1 + vec3(wX, wY, wZ) * 0.8;
    float plasma = fbm(warpedPos);
    
    // Higher-frequency details
    float detail = fbm(vObjPos * 12.0 - vec3(0.0, uTime * 0.12, 0.0));
    float finalNoise = mix(plasma, detail, 0.3);

    // Sunspots (cool magnetic spots)
    float spotsNoise = fbm(vObjPos * 2.2 + vec3(uTime * 0.01));
    float spot = smoothstep(0.35, 0.22, spotsNoise);

    // Color gradient mapping:
    // Core color goes from dark deep red/orange to bright yellow/white hot spots
    vec3 baseColor = uColor;
    vec3 darkPlasma = baseColor * 0.4;
    vec3 brightPlasma = baseColor * 1.5;
    
    vec3 col = mix(darkPlasma, brightPlasma, finalNoise);
    
    // Add white-hot granulation peaks
    vec3 hotGranulation = vec3(1.0, 0.9, 0.7) * pow(finalNoise, 3.5) * 1.8 * baseColor;
    col += hotGranulation;
    
    // Apply sunspots
    col = mix(col, baseColor * 0.15, spot * 0.7);
    
    // Apply limb darkening (darker edges)
    col *= (0.35 + 0.65 * limb);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const CORONA_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vPositionW = worldPos.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const CORONA_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vPositionW);
    float NdotV = max(0.0, dot(normalize(vNormalW), viewDir));
    // Rim glow: brightest at the edges (NdotV -> 0), fading out inside and outside.
    float intensity = pow(1.0 - NdotV, 3.5) * 1.8;
    gl_FragColor = vec4(uColor, intensity);
  }
`;

/**
 * Physically-motivated central star: the scene's primary light source via a
 * co-located point light with a Kelvin-derived color, a granulated + limb-darkened
 * HDR surface (so it triggers Bloom), and a soft Fresnel corona.
 */
export default function StarMesh({
  temperature,
  jitter = false,
  radius = 1.4,
  lightIntensity = 800,
  position,
}: Props) {
  const coreRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  const color = useMemo(() => kelvinToColor(temperature), [temperature]);

  const surfaceMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          // HDR (> 1) so it survives into the Bloom pass.
          uColor: { value: color.clone().multiplyScalar(2.6) },
          uTime: { value: 0 },
        },
        vertexShader: SURFACE_VERT,
        fragmentShader: SURFACE_FRAG,
      }),
    [color]
  );

  const coronaMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: color.clone().multiplyScalar(1.5) } },
        vertexShader: CORONA_VERT,
        fragmentShader: CORONA_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        depthWrite: false,
      }),
    [color]
  );

  const coreGeometry = useMemo(() => new THREE.SphereGeometry(radius, 48, 48), [radius]);
  const coronaGeometry = useMemo(() => new THREE.SphereGeometry(radius, 32, 32), [radius]);

  useEffect(() => {
    return () => {
      surfaceMaterial.dispose();
      coronaMaterial.dispose();
      coreGeometry.dispose();
      coronaGeometry.dispose();
    };
  }, [surfaceMaterial, coronaMaterial, coreGeometry, coronaGeometry]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    surfaceMaterial.uniforms.uTime.value = t;
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.035;
      coreRef.current.scale.setScalar(jitter ? 1 + Math.sin(t * 2.5) * 0.025 : 1);
    }
    if (lightRef.current) {
      lightRef.current.intensity = jitter
        ? lightIntensity * (1 + Math.sin(t * 2.5) * 0.06)
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
        <primitive object={surfaceMaterial} attach="material" />
      </mesh>

      <mesh scale={1.25} geometry={coronaGeometry}>
        <primitive object={coronaMaterial} attach="material" />
      </mesh>
    </group>
  );
}
