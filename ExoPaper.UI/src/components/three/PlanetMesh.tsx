import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Ring } from "@react-three/drei";
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
  semiMajorAxisAu?: number | null;
  isHwoCandidate?: boolean;
  /** Starting angle on the orbit (radians) — lets several planets share a scene. */
  phase?: number;
  inclination?: number;
  starPosition?: [number, number, number];
  position?: [number, number, number];
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
}: Props) {
  const planetRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);

  const radius = radiusEarth ?? 1;
  const gaseous = radius >= 2.0;

  const scale = useMemo(
    () => Math.min(Math.max(radius * 0.22, 0.35), 1.4),
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
    // Speed multiplier to make orbits dynamic in the view
    const timeScaleMultiplier = 30.0;
    return (1 / period) * timeScaleMultiplier;
  }, [orbitalPeriod]);

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

  useFrame((state) => {
    const angle = state.clock.elapsedTime * speed + phase;
    
    // Strict Orbital Mechanics on XZ Plane centered at 0,0,0 of the parent group
    const x = computedOrbitRadius * Math.cos(angle);
    const z = computedOrbitRadius * Math.sin(angle);
    
    // Vertical bobbing if inclination is set
    const y = Math.sin(angle * 0.7) * inclination;

    if (planetRef.current) {
      planetRef.current.position.set(x, y, z);
    }
    
    // Self-Rotation: rotate the planet on its own Y-axis
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group position={position}>
      {/* 1. Visual Orbit Line: Flat on the XZ plane */}
      <Ring args={[computedOrbitRadius, computedOrbitRadius + 0.05, 64]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#88C0D0" opacity={0.12} transparent depthWrite={false} />
      </Ring>

      {/* 2. The Planet Mesh Group: Moves around the central origin */}
      <group ref={planetRef}>
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
    </group>
  );
}
