import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import StarMesh from "./StarMesh";
import PlanetMesh from "./PlanetMesh";
import OrbitRing from "./OrbitRing";
import CanvasErrorBoundary from "../common/CanvasErrorBoundary";
import { hashStringToSeed } from "./stellar";

interface HeroPlanetConfig {
  radiusEarth: number;
  orbitRadius: number;
  orbitalPeriod: number;
  phase: number;
  inclination: number;
  isHwoCandidate: boolean;
  seed: number;
}

function Scene() {
  const planets = useMemo<HeroPlanetConfig[]>(() => {
    const specs = [
      { radiusEarth: 1.0, orbitRadius: 3.8, orbitalPeriod: 40, isHwoCandidate: true },
      { radiusEarth: 3.4, orbitRadius: 5.6, orbitalPeriod: 95, isHwoCandidate: false },
      { radiusEarth: 0.8, orbitRadius: 7.4, orbitalPeriod: 165, isHwoCandidate: false },
      { radiusEarth: 5.2, orbitRadius: 9.4, orbitalPeriod: 260, isHwoCandidate: false },
    ];
    return specs.map((s, i) => ({
      ...s,
      phase: (i / specs.length) * Math.PI * 2,
      inclination: 0.4 + i * 0.25,
      seed: hashStringToSeed(`hero-planet-${i}`),
    }));
  }, []);

  return (
    <>
      <ambientLight intensity={0.03} />
      <Stars radius={140} depth={70} count={5000} factor={4.5} saturation={0} fade speed={0.35} />

      {/* Sun-like central star lighting the whole system */}
      <StarMesh temperature={5800} jitter={false} radius={1.5} lightIntensity={120} position={[8, 4, -5]} />

      {planets.map((p) => (
        <group key={p.seed}>
          <OrbitRing radius={p.orbitRadius} position={[8, 4, -5]} />
          <PlanetMesh
            radiusEarth={p.radiusEarth}
            seed={p.seed}
            orbitRadius={p.orbitRadius}
            orbitalPeriod={p.orbitalPeriod}
            isHwoCandidate={p.isHwoCandidate}
            phase={p.phase}
            inclination={p.inclination}
            starPosition={[8, 4, -5]}
          />
        </group>
      ))}

      <EffectComposer multisampling={4}>
        <Bloom luminanceThreshold={1.0} intensity={0.7} mipmapBlur radius={0.75} />
        <Vignette eskil={false} offset={0.2} darkness={0.9} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}

/**
 * Full-bleed animated cosmos for the dashboard hero. Non-interactive
 * (pointer-events handled by the parent) so overlay UI stays usable.
 */
export default function CosmicHero() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <CanvasErrorBoundary>
        <Canvas
          camera={{ position: [0, 2.5, 14], fov: 55 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.NoToneMapping,
          }}
          dpr={[1, 1.5]}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
