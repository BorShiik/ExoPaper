import React, { Suspense, lazy, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { usePageVisible } from "../../lib/usePageVisible";
import * as THREE from "three";
import StarMesh from "./StarMesh";
import PlanetMesh from "./PlanetMesh";
import CanvasErrorBoundary from "../common/CanvasErrorBoundary";
import { hashStringToSeed } from "./stellar";

const ScenePostFX = lazy(() => import("./ScenePostFX"));

const STAR_POS: [number, number, number] = [3.2, 1.2, -4];

interface HeroPlanetConfig {
  radiusEarth: number;
  orbitRadius: number;
  orbitalPeriod: number;
  phase: number;
  inclination: number;
  isHwoCandidate: boolean;
  seed: number;
}

/**
 * Cinematic Parallax Camera — Reads scroll directly from DOM to completely avoid
 * React re-renders and GC pauses. Smoothly lerps between 3 keyframes.
 */
function ParallaxCamera() {
  const { camera } = useThree();
  
  // Pre-allocate vectors to avoid GC in the useFrame loop
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const currentLook = useRef(new THREE.Vector3(3.2, 1.2, -2));
  
  // Drift base vectors
  const basePos = useRef(new THREE.Vector3());
  
  useFrame((state) => {
    const scrollEl = document.getElementById("main-scroll-container");
    let progress = 0;
    
    if (scrollEl) {
      const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
      if (maxScroll > 0) {
        progress = Math.min(Math.max(scrollEl.scrollTop / maxScroll, 0), 1);
      }
    }

    // Keyframes
    // 0.0 -> Hero
    // 0.5 -> Metrics
    // 1.0 -> Analytics
    if (progress < 0.5) {
      const p = progress / 0.5;
      basePos.current.lerpVectors(
        new THREE.Vector3(0, 2.5, 14),
        new THREE.Vector3(0, -1, 10),
        p
      );
      targetLook.current.lerpVectors(
        new THREE.Vector3(3.2, 1.2, -2),
        new THREE.Vector3(3.2, 4, -2),
        p
      );
    } else {
      const p = (progress - 0.5) / 0.5;
      basePos.current.lerpVectors(
        new THREE.Vector3(0, -1, 10),
        new THREE.Vector3(3, 0.5, 4),
        p
      );
      targetLook.current.lerpVectors(
        new THREE.Vector3(3.2, 4, -2),
        new THREE.Vector3(5, 0, -5),
        p
      );
    }

    // Apply subtle breathing drift ON TOP of the parallax position
    const t = state.clock.elapsedTime;
    targetPos.current.x = basePos.current.x + Math.sin(t * 0.08) * 0.9;
    targetPos.current.y = basePos.current.y + Math.sin(t * 0.11) * 0.45;
    targetPos.current.z = basePos.current.z + Math.cos(t * 0.06) * 0.6;

    // Smoothly ease the camera to the target position
    camera.position.lerp(targetPos.current, 0.05);
    
    // Smoothly ease the lookAt target
    currentLook.current.lerp(targetLook.current, 0.05);
    camera.lookAt(currentLook.current);
  });
  return null;
}

function Scene() {
  const planets = useMemo<HeroPlanetConfig[]>(() => {
    const specs = [
      { radiusEarth: 1.0, orbitRadius: 5.8, orbitalPeriod: 40, isHwoCandidate: true },
      { radiusEarth: 3.4, orbitRadius: 8.2, orbitalPeriod: 95, isHwoCandidate: false },
      { radiusEarth: 0.8, orbitRadius: 10.6, orbitalPeriod: 165, isHwoCandidate: false },
      { radiusEarth: 5.2, orbitRadius: 13.4, orbitalPeriod: 260, isHwoCandidate: false },
    ];
    return specs.map((s, i) => ({
      ...s,
      phase: (i / specs.length) * Math.PI * 2,
      inclination: 0.1 + i * 0.05,
      seed: hashStringToSeed(`hero-planet-${i}`),
    }));
  }, []);

  return (
    <>
      <ParallaxCamera />
      <ambientLight intensity={0.14} />
      {/* Cool blue fill light to make the night sides of the planets visible */}
      <directionalLight position={[-8, 6, 12]} intensity={0.8} color="#88C0D0" />

      {/* Two depth layers of stars give real parallax as the camera drifts. */}
      <Stars radius={140} depth={70} count={4200} factor={4.5} saturation={0} fade speed={0.3} />
      <Stars radius={70} depth={40} count={1400} factor={3} saturation={0} fade speed={0.5} />

      {/* Sun-like central star lighting the whole system */}
      <StarMesh temperature={5800} jitter radius={1.5} lightIntensity={600} position={STAR_POS} />

      {planets.map((p) => (
        <PlanetMesh
          key={p.seed}
          radiusEarth={p.radiusEarth}
          seed={p.seed}
          orbitRadius={p.orbitRadius}
          orbitalPeriod={p.orbitalPeriod}
          isHwoCandidate={p.isHwoCandidate}
          phase={p.phase}
          inclination={p.inclination}
          starPosition={STAR_POS}
          position={STAR_POS}
        />
      ))}

      <ScenePostFX
        bloomThreshold={0.85}
        bloomIntensity={1.0}
        bloomRadius={0.85}
        vignetteOffset={0.2}
        vignetteDarkness={0.92}
      />
    </>
  );
}

/**
 * Full-bleed animated cosmos for the dashboard hero. Non-interactive
 * (pointer-events handled by the parent) so overlay UI stays usable.
 */
const CosmicHero = React.memo(function CosmicHero() {
  const visible = usePageVisible();
  const [mounted, setMounted] = React.useState(false);

  // Defer rendering of the heavy WebGL canvas until the browser has painted
  // the initial DOM (First Contentful Paint). This massively improves performance scores.
  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 animate-fade-in" aria-hidden="true">
      <CanvasErrorBoundary>
        <Canvas
          camera={{ position: [0, 2.5, 14], fov: 55 }}
          frameloop={visible ? "always" : "never"}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.NoToneMapping,
          }}
          dpr={[1, 1.75]}
          style={{ background: "transparent" }}
        >
          <PerformanceMonitor />
          <AdaptiveDpr pixelated />
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
});

export default CosmicHero;
