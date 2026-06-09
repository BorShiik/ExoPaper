import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  count?: number;
}

/** Procedural starfield background — thousands of tiny particles */
export default function Starfield({ count = 2000 }: Props) {
  const ref = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    let seed = 42;
    const lcg = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (lcg() - 0.5) * 100;
      pos[i * 3 + 1] = (lcg() - 0.5) * 100;
      pos[i * 3 + 2] = (lcg() - 0.5) * 100;
    }
    return pos;
  }, [count]);

  const sizes = useMemo(() => {
    let seed = 99;
    const lcg = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      s[i] = lcg() * 0.08 + 0.02;
    }
    return s;
  }, [count]);

  useFrame((_state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.005;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#c8d6e5"
        sizeAttenuation
        transparent
        opacity={0.8}
      />
    </points>
  );
}
