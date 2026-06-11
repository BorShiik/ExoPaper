import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  /** Planet visual scale (sphere radius in scene units). */
  scale: number;
  seed: number;
  /** Ring tint (CSS hex). */
  color: string;
  /** World-space position of the illuminating star. */
  starPosition: [number, number, number];
}

const RING_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const RING_FRAG = /* glsl */ `
  uniform float uInner;
  uniform float uOuter;
  uniform float uSeed;
  uniform float uPlanetRadius;
  uniform vec3 uColor;
  uniform vec3 uPlanetCenter;
  uniform vec3 uStarPos;
  varying vec3 vWorldPos;
  varying vec2 vLocal;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float vnoise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
  }
  float fbm(float x) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * vnoise(x); x *= 2.0; a *= 0.5; }
    return s;
  }

  void main() {
    float r = length(vLocal);
    float t = (r - uInner) / (uOuter - uInner);
    if (t < 0.0 || t > 1.0) discard;

    // Fine radial banding + low-frequency density variation.
    float fine = 0.5 + 0.5 * sin(t * 160.0 + uSeed * 12.0);
    float coarse = fbm(t * 22.0 + uSeed * 3.0);
    float bands = mix(coarse, fine, 0.45);
    float density = mix(0.18, 1.0, bands);

    // A couple of Cassini-style gaps.
    float gaps = smoothstep(0.015, 0.05, abs(fract(t * 2.7 + uSeed) - 0.5));
    density *= gaps;

    // Soft inner / outer edges.
    density *= smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.93, t);

    // Cylindrical planet shadow cast across the rings (the iconic Saturn look).
    vec3 P = vWorldPos - uPlanetCenter;
    vec3 L = normalize(uStarPos - uPlanetCenter);
    float along = dot(P, L);
    float perp = length(P - along * L);
    float shadow = 1.0;
    if (along < 0.0) {
      shadow = smoothstep(uPlanetRadius * 0.92, uPlanetRadius * 1.12, perp);
      shadow = mix(0.12, 1.0, shadow);
    }

    vec3 col = uColor * (0.45 + 0.55 * bands);
    float alpha = clamp(density, 0.0, 1.0) * shadow * 0.62;
    gl_FragColor = vec4(col, alpha);
  }
`;

/** Procedural, shader-driven planetary ring system with banding and a cast planet shadow. */
export default function PlanetRings({ scale, seed, color, starPosition }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const center = useMemo(() => new THREE.Vector3(), []);

  const inner = scale * 1.35;
  const outer = scale * 2.25;

  // Seeded tilt is now handled by the parent PlanetMesh so the planet equator aligns with the rings
  const tilt = useMemo<[number, number, number]>(() => {
    return [-Math.PI / 2, 0, 0];
  }, []);

  const geometry = useMemo(() => new THREE.RingGeometry(inner, outer, 180, 8), [inner, outer]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        uniforms: {
          uInner: { value: inner },
          uOuter: { value: outer },
          uSeed: { value: (seed % 1000) / 1000 },
          uPlanetRadius: { value: scale },
          uColor: { value: new THREE.Color(color) },
          uPlanetCenter: { value: new THREE.Vector3() },
          uStarPos: { value: new THREE.Vector3(...starPosition) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [inner, outer, seed, scale, color, starPosition]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(() => {
    if (meshRef.current) {
      // Planet centre = ring mesh world position (rings sit at the planet origin).
      meshRef.current.getWorldPosition(center);
      material.uniforms.uPlanetCenter.value.copy(center);
    }
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} rotation={tilt} />;
}
