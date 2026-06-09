import { useMemo, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { generateCloudTextureGPU } from "./proceduralPlanetGPU";
import { useAppStore } from "../../stores/appStore";

interface Props {
  radius: number;
  seed: number;
}

export default function CloudMesh({ radius, seed }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { gl } = useThree();
  const graphicsQuality = useAppStore((s) => s.graphicsQuality);

  const cloudTex = useMemo(
    () => generateCloudTextureGPU(gl, seed, graphicsQuality === "high" ? 2048 : 512),
    [gl, seed, graphicsQuality]
  );

  const segments = useMemo(() => (graphicsQuality === "high" ? 48 : 32), [graphicsQuality]);
  const geometry = useMemo(() => new THREE.SphereGeometry(radius, segments, segments), [radius, segments]);

  useEffect(() => {
    return () => {
      cloudTex.dispose();
      geometry.dispose();
    };
  }, [cloudTex, geometry]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.025; // Clouds drift relative to surface
    }
  });

  return (
    <mesh ref={meshRef} scale={1.015} castShadow receiveShadow geometry={geometry}>
      <meshStandardMaterial
        map={cloudTex}
        transparent
        depthWrite={false}
        opacity={0.85}
        roughness={0.9}
        color={0xffffff}
      />
    </mesh>
  );
}
