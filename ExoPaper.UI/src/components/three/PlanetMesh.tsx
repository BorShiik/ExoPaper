import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { generatePlanetTexturesGPU } from "./proceduralPlanetGPU";
import VolumetricAtmosphere from "./VolumetricAtmosphere";
import CloudMesh from "./CloudMesh";
import { useAppStore } from "../../stores/appStore";

interface Props {
  radiusEarth: number | null | undefined;
  /** Stable seed (hash of the planet id/name) for deterministic generation. */
  seed: number;
  orbitRadius?: number;
  orbitalPeriod?: number | null;
  isHwoCandidate?: boolean;
  /** Starting angle on the orbit (radians) — lets several planets share a scene. */
  phase?: number;
  /** Orbital inclination amplitude (vertical bob). */
  inclination?: number;
  starPosition?: [number, number, number];
}

/** Procedural exoplanet rendered with PBR materials, shadows and an atmosphere. */
export default function PlanetMesh({
  radiusEarth,
  seed,
  orbitRadius = 4,
  orbitalPeriod,
  isHwoCandidate = false,
  phase = 0,
  inclination = 0,
  starPosition = [8, 4, -5],
}: Props) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);

  const radius = radiusEarth ?? 1;
  const gaseous = radius >= 2.0;

  const scale = useMemo(
    () => Math.min(Math.max(radius * 0.22, 0.35), 1.4),
    [radius]
  );

  const speed = useMemo(
    () => (orbitalPeriod ? Math.max(0.01, 0.15 / Math.log10(orbitalPeriod + 2)) : 0.05),
    [orbitalPeriod]
  );

  const { gl } = useThree();
  const graphicsQuality = useAppStore((s) => s.graphicsQuality);

  const textures = useMemo(
    () =>
      generatePlanetTexturesGPU(
        gl,
        seed,
        gaseous,
        graphicsQuality === "high" ? 2048 : 512
      ),
    [gl, seed, gaseous, graphicsQuality]
  );

  const segments = useMemo(() => {
    if (graphicsQuality === "low") return 32;
    return gaseous ? 64 : 48;
  }, [gaseous, graphicsQuality]);

  const geometry = useMemo(() => new THREE.SphereGeometry(scale, segments, segments), [scale, segments]);

  useEffect(() => {
    return () => {
      textures.dispose();
      geometry.dispose();
    };
  }, [textures, geometry]);

  const normalScale = useMemo(
    () => new THREE.Vector2(gaseous ? 0.5 : 2.2, gaseous ? 0.5 : 2.2),
    [gaseous]
  );

  const showAtmosphere = !gaseous;
  const atmosphereColor = isHwoCandidate ? "#86ffc0" : "#7fb8ff";

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime() * speed * 0.15 + phase;
    if (groupRef.current) {
      groupRef.current.position.x = Math.cos(t) * orbitRadius;
      groupRef.current.position.z = Math.sin(t) * orbitRadius;
      groupRef.current.position.y = Math.sin(t * 0.7) * inclination;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * (gaseous ? 0.015 : 0.005);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} castShadow receiveShadow geometry={geometry}>
        <meshStandardMaterial
          map={textures.map}
          normalMap={textures.normalMap}
          normalScale={normalScale}
          roughnessMap={textures.roughnessMap}
          roughness={1}
          metalness={0}
          envMapIntensity={0.35}
        />
      </mesh>

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
  );
}
