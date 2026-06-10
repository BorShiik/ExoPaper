import React, { Suspense, lazy, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import type { Exoplanet } from "../../types";
import StarMesh from "./StarMesh";
import PlanetMesh from "./PlanetMesh";
import DustDisk from "./DustDisk";
import CanvasErrorBoundary from "../common/CanvasErrorBoundary";
import { hashStringToSeed } from "./stellar";
import { useAppStore } from "../../stores/appStore";
import { usePageVisible } from "../../lib/usePageVisible";

const ScenePostFX = lazy(() => import("./ScenePostFX"));

interface Props {
  planet: Exoplanet;
}

/** Same visual-scale mapping PlanetMesh uses, so we can frame the camera to fit. */
function visualScale(radiusEarth: number | null | undefined): number {
  const r = radiusEarth && radiusEarth > 0 ? radiusEarth : 1;
  return THREE.MathUtils.clamp(r * 0.45, 0.6, 2.2);
}

/**
 * Focused, physically-lit portrait of a single exoplanet. The planet sits at the
 * origin; a single shadow-casting point light (inside StarMesh) sits off to one
 * side so the day/night terminator reads cleanly. The star is the only meaningful
 * light source — renderer tone mapping is disabled so HDR values survive into Bloom.
 */
const ExoplanetScene = React.memo(function ExoplanetScene({ planet }: Props) {
  const isHwoCandidate = planet.tags?.includes("HWO Candidate");
  const hasJitter = planet.discoveryMethod === "Radial Velocity";
  const seed = useMemo(
    () => hashStringToSeed(planet.id || planet.name || "exoplanet"),
    [planet.id, planet.name]
  );

  // Data-driven framing: bigger worlds get a wider camera pull-back.
  const scale = useMemo(() => visualScale(planet.radiusEarth), [planet.radiusEarth]);
  const camDist = THREE.MathUtils.clamp(scale * 3.4 + 1.8, 4, 9);
  const cameraPos = useMemo<[number, number, number]>(
    () => [0, scale * 0.45, camDist],
    [scale, camDist]
  );

  // Star sits to the camera-facing right so we see a lit gibbous with a clear
  // terminator sweeping across the visible disc.
  const starPos: [number, number, number] = [camDist * 1.1, scale * 1.3 + 1.2, camDist * 0.4];

  // Debris / dust disk for microlensing targets (e.g. MOA-2008-BLG-310L b) and
  // planets sitting in the dusty inner-system zone.
  const showDust =
    planet.discoveryMethod === "Microlensing" ||
    (planet.semiMajorAxisAu != null && planet.semiMajorAxisAu >= 0.4 && planet.semiMajorAxisAu <= 3.0);

  const graphicsQuality = useAppStore((s) => s.graphicsQuality);
  const visible = usePageVisible();
  const highFx = graphicsQuality === "high";

  return (
    <div className="h-full w-full overflow-hidden" aria-hidden="true">
      <CanvasErrorBoundary>
        <Canvas
          shadows={highFx}
          frameloop={visible ? "always" : "never"}
          camera={{ position: cameraPos, fov: 45 }}
          gl={{
            antialias: highFx,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.NoToneMapping,
          }}
          dpr={[1, highFx ? 2 : 1.25]}
        >
          {/* Auto-scale resolution down on sustained low frame-rates, restore when it recovers. */}
          <PerformanceMonitor />
          <AdaptiveDpr pixelated />
          <color attach="background" args={["#05070f"]} />

          <Suspense fallback={null}>
            {/* Only a whisper of ambient so the night side keeps its shape without
                flattening the terminator — the star provides everything else. */}
            <ambientLight intensity={0.06} />

            {/* Deep-space backdrop */}
            <Stars radius={120} depth={60} count={4500} factor={4} saturation={0} fade speed={0.4} />

            {/* The single light source, positioned at the star's center. */}
            <StarMesh
              temperature={planet.stellarEffectiveTemperatureK}
              jitter={hasJitter}
              radius={1.3}
              lightIntensity={Math.max(140, camDist * camDist * 2.6)}
              position={starPos}
            />

            {/* The target planet, centered and self-rotating. */}
            <PlanetMesh
              radiusEarth={planet.radiusEarth}
              seed={seed}
              semiMajorAxisAu={planet.semiMajorAxisAu}
              orbitalPeriod={planet.orbitalPeriodDays}
              isHwoCandidate={isHwoCandidate}
              orbit={false}
              position={[0, 0, 0]}
              starPosition={starPos}
              equilibriumTemperatureK={planet.equilibriumTemperatureK}
            />

            {/* Debris/dust disk around the planet — tilted for depth; the planet
                writes depth so its body naturally occludes the far arc. */}
            {showDust && (
              <group rotation={[0.32, 0, 0]}>
                <DustDisk innerRadius={scale * 1.7} outerRadius={scale * 4.3} />
              </group>
            )}

            <OrbitControls
              makeDefault
              enablePan={false}
              minDistance={Math.max(2.6, scale * 1.5)}
              maxDistance={16}
              autoRotate
              autoRotateSpeed={0.35}
              target={[0, 0, 0]}
            />

            <ScenePostFX
              smaa={highFx}
              bloomThreshold={1.0}
              bloomIntensity={0.85}
              bloomRadius={0.85}
              vignetteOffset={0.15}
              vignetteDarkness={0.9}
            />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
});

export default ExoplanetScene;
