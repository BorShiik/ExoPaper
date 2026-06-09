import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ToneMapping, SMAA } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { Exoplanet } from "../../types";
import StarMesh from "./StarMesh";
import PlanetMesh from "./PlanetMesh";
import DustDisk from "./DustDisk";
import CanvasErrorBoundary from "../common/CanvasErrorBoundary";
import { hashStringToSeed } from "./stellar";

interface Props {
  planet: Exoplanet;
}

/**
 * Cinematic, physically-lit 3D view of a single exoplanet system.
 * The star is the only meaningful light source; tone mapping + bloom are applied
 * in the post-processing stack (renderer tone mapping is disabled so HDR values
 * survive into the Bloom pass).
 */
export default function ExoplanetScene({ planet }: Props) {
  const isHwoCandidate = planet.tags?.includes("HWO Candidate");
  const hasJitter = planet.discoveryMethod === "Radial Velocity";
  const seed = useMemo(
    () => hashStringToSeed(planet.id || planet.name || "exoplanet"),
    [planet.id, planet.name]
  );

  const showDust =
    planet.semiMajorAxisAu != null &&
    planet.semiMajorAxisAu >= 0.5 &&
    planet.semiMajorAxisAu <= 2.0;

  return (
    <div className="three-canvas-container h-full w-full overflow-hidden rounded-xl">
      <CanvasErrorBoundary>
        <Canvas
          shadows
          camera={{ position: [0, 4, 10], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.NoToneMapping,
          }}
          dpr={[1, 1.5]}
        >
          <color attach="background" args={["#05070f"]} />

          <Suspense fallback={null}>
            {/* Harsh space lighting: only a whisper of ambient so the night side
                isn't pitch black; the star provides everything else. */}
            <ambientLight intensity={0.02} />

            {/* Deep-space backdrop */}
            <Stars radius={120} depth={60} count={4500} factor={4} saturation={0} fade speed={0.4} />

            <StarMesh temperature={planet.stellarEffectiveTemperatureK} jitter={hasJitter} position={[8, 4, -5]} />

            <PlanetMesh
              radiusEarth={planet.radiusEarth}
              seed={seed}
              orbitRadius={9}
              semiMajorAxisAu={planet.semiMajorAxisAu}
              orbitalPeriod={planet.orbitalPeriodDays}
              isHwoCandidate={isHwoCandidate}
              position={[8, 4, -5]}
              starPosition={[8, 4, -5]}
            />

            {showDust && <DustDisk />}

            <OrbitControls
              enablePan={false}
              minDistance={3}
              maxDistance={20}
              autoRotate
              autoRotateSpeed={0.3}
            />

            <EffectComposer multisampling={0}>
              <SMAA />
              {/* Threshold ~1.0 → only the (HDR) star and bright rims bloom. */}
              <Bloom luminanceThreshold={1.0} intensity={0.9} mipmapBlur radius={0.85} />
              <Vignette eskil={false} offset={0.15} darkness={0.85} />
              <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            </EffectComposer>
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
