import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  innerRadius?: number;
  outerRadius?: number;
}

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float d = distance(vUv, vec2(0.5));
    // d goes from ~inner to 0.5 (outer)
    // we fade out at edges to simulate soft volumetric dust
    float alpha = smoothstep(0.5, 0.35, d) * smoothstep(0.1, 0.25, d);
    gl_FragColor = vec4(uColor, alpha * 0.12);
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export default function DustDisk({ innerRadius = 2.5, outerRadius = 6 }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z -= delta * 0.015;
    }
  });

  const geometry = useMemo(
    () => new THREE.RingGeometry(innerRadius, outerRadius, 64),
    [innerRadius, outerRadius]
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0xf59e0b) },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]} geometry={geometry}>
      <primitive object={material} attach="material" />
    </mesh>
  );
}
