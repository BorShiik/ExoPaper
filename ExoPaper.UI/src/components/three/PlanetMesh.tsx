import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Ring } from "@react-three/drei";
import * as THREE from "three";
import { generatePlanetTexturesGPU } from "./proceduralPlanetGPU";
import { createGasGiantMaterial } from "./gasGiantMaterial";
import VolumetricAtmosphere from "./VolumetricAtmosphere";
import CloudMesh from "./CloudMesh";
import { useAppStore } from "../../stores/appStore";

interface Props {
  radiusEarth: number | null | undefined;
  /** Stable seed (hash of the planet id/name) for deterministic generation. */
  seed: number;
  orbitRadius?: number;
  orbitalPeriod?: number | null;
  semiMajorAxisAu?: number | null;
  isHwoCandidate?: boolean;
  /** Starting angle on the orbit (radians) — lets several planets share a scene. */
  phase?: number;
  inclination?: number;
  starPosition?: [number, number, number];
  position?: [number, number, number];
  /** Multiplier on orbital speed. 1 = calm cinematic default. */
  orbitSpeedScale?: number;
  /** When false, the planet stays centered (self-rotation only) and the orbit
   *  ring is hidden — used by the focused detail view. Default: true. */
  orbit?: boolean;
}

/** Procedural exoplanet rendered with PBR materials, shadows and an atmosphere. */
export default function PlanetMesh({
  radiusEarth,
  seed,
  orbitRadius = 9,
  orbitalPeriod,
  semiMajorAxisAu,
  isHwoCandidate = false,
  phase = 0,
  inclination = 0,
  starPosition = [8, 4, -5],
  position = [8, 4, -5],
  orbitSpeedScale = 1,
  orbit = true,
}: Props) {
  const planetRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);

  const radius = radiusEarth ?? 1;
  const gaseous = radius >= 2.0;

  const scale = useMemo(
    () => Math.min(Math.max(radius * 0.45, 0.6), 2.2), // Increased base scale to make planets visible
    [radius]
  );

  const computedOrbitRadius = useMemo(() => {
    if (semiMajorAxisAu && semiMajorAxisAu > 0) {
      return semiMajorAxisAu * 10;
    }
    return orbitRadius;
  }, [semiMajorAxisAu, orbitRadius]);

  const speed = useMemo(() => {
    const period = orbitalPeriod && orbitalPeriod > 0 ? orbitalPeriod : 365.0;
    const timeScaleMultiplier = 7.5;
    return (1 / period) * timeScaleMultiplier * orbitSpeedScale;
  }, [orbitalPeriod, orbitSpeedScale]);

  const { gl } = useThree();
  const graphicsQuality = useAppStore((s) => s.graphicsQuality);

  // Rocky planets use procedural PBR textures; gas giants use an animated shader.
  const textures = useMemo(
    () =>
      gaseous
        ? null
        : generatePlanetTexturesGPU(gl, seed, false, graphicsQuality === "high" ? 2048 : 512),
    [gl, seed, gaseous, graphicsQuality]
  );

  const gas = useMemo(() => (gaseous ? createGasGiantMaterial(seed) : null), [gaseous, seed]);

  const segments = useMemo(() => {
    if (graphicsQuality === "low") return 32;
    return gaseous ? 64 : 48;
  }, [gaseous, graphicsQuality]);

  const geometry = useMemo(() => new THREE.SphereGeometry(scale, segments, segments), [scale, segments]);

  useEffect(() => {
    return () => {
      textures?.dispose();
      gas?.material.dispose();
      geometry.dispose();
    };
  }, [textures, gas, geometry]);

  const normalScale = useMemo(
    () => new THREE.Vector2(gaseous ? 0.5 : 2.2, gaseous ? 0.5 : 2.2),
    [gaseous]
  );

  const showAtmosphere = !gaseous;
  const atmosphereColor = isHwoCandidate ? "#86ffc0" : "#7fb8ff";

  useFrame((state, delta) => {
    // Orbital translation only in orbit mode; the detail view keeps the planet
    // centered at the group origin so the camera can focus on it.
    if (orbit && planetRef.current) {
      const angle = state.clock.elapsedTime * speed + phase;
      const x = computedOrbitRadius * Math.cos(angle);
      const z = computedOrbitRadius * Math.sin(angle);
      // Y is 0 because the entire group is rotated by the inclination!
      planetRef.current.position.set(x, 0, z);
    }

    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.12;
    }

    // Animate gas-band turbulence (mutates an existing uniform — no allocation).
    if (gas) {
      gas.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group position={position} rotation={[inclination, 0, 0]}>
      {/* 1. Visual Orbit Line: Intricate glowing rings (orbit mode only) */}
      {orbit && (
        <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
          <Ring args={[computedOrbitRadius - 0.04, computedOrbitRadius + 0.04, 128]}>
            <meshBasicMaterial color="#88C0D0" opacity={0.15} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </Ring>
          <Ring args={[computedOrbitRadius - 0.008, computedOrbitRadius + 0.008, 128]}>
            <meshBasicMaterial color="#E5E9F0" opacity={0.5} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </Ring>
        </group>
      )}

      {/* 2. The Planet Mesh Group: Moves around the central origin */}
      <group ref={planetRef}>
        {gas ? (
          // Gas giant: animated banded atmosphere (PBR-lit via onBeforeCompile).
          <mesh ref={meshRef} castShadow receiveShadow geometry={geometry} material={gas.material} />
        ) : (
          <mesh ref={meshRef} castShadow receiveShadow geometry={geometry}>
            <meshStandardMaterial
              map={textures!.map}
              normalMap={textures!.normalMap}
              normalScale={normalScale}
              roughnessMap={textures!.roughnessMap}
              roughness={1}
              metalness={0}
              envMapIntensity={0.35}
            />
          </mesh>
        )}

        {showAtmosphere && (
          <>
            <CloudMesh radius={scale} seed={seed} />
            <VolumetricAtmosphere
              radius={scale}
              color={atmosphereColor}
              scale={1.12}
              starPosition={starPosition}
            />
          </>
        )}
      </group>
    </group>
  );
}
