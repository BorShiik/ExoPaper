import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  innerRadius: number;
  outerRadius: number;
  seed: number;
  count?: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A seeded debris belt rendered as a single InstancedMesh (one draw call for the
 * whole belt). Static per-instance transforms; only the parent group rotates, so
 * there is zero per-frame matrix work.
 */
export default function InstancedAsteroids({ innerRadius, outerRadius, seed, count = 48 }: Props) {
  const ref = useRef<THREE.InstancedMesh>(null!);

  // Smooth (detail-2) icosahedra read as rounded boulders rather than faceted shards.
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 1, metalness: 0, flatShading: false }),
    []
  );

  useEffect(() => {
    const rng = mulberry32(seed || 1);
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scl = new THREE.Vector3();
    const color = new THREE.Color();

    const span = outerRadius - innerRadius;
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const r = innerRadius + rng() * span;
      const y = (rng() - 0.5) * span * 0.05; // thin belt
      pos.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
      euler.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      quat.setFromEuler(euler);
      // Base size ~0.03–0.085 scene units; irregular (non-uniform) for a rocky look.
      const s = 0.03 + rng() * rng() * 0.055; // bias toward smaller, a few large
      scl.set(s, s * (0.65 + rng() * 0.5), s * (0.75 + rng() * 0.4));
      m.compose(pos, quat, scl);
      ref.current.setMatrixAt(i, m);

      // Subtle per-rock colour variation (brown → grey).
      color.setHSL(0.07 + rng() * 0.03, 0.18 + rng() * 0.12, 0.32 + rng() * 0.14);
      ref.current.setColorAt(i, color);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [innerRadius, outerRadius, seed, count]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_s, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02;
  });

  return <instancedMesh ref={ref} args={[geometry, material, count]} castShadow />;
}
