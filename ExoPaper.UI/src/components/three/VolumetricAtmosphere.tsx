import { useMemo, useEffect } from "react";
import * as THREE from "three";

interface Props {
  radius: number;
  color: THREE.ColorRepresentation;
  starPosition?: [number, number, number];
  scale?: number;
}

const VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vPositionW = worldPos.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// Analytical approximation of Rayleigh/Mie scattering.
const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uStarPos;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPositionW);
    vec3 L = normalize(uStarPos - vPositionW);
    
    float NdotV = max(0.0, dot(N, V));
    float NdotL = max(0.0, dot(N, L));
    float VdotL = max(0.0, dot(V, L));
    
    // Optical depth through the edge of the sphere
    float opticalDepth = exp(-pow(1.0 - NdotV, 3.5) * 5.0);
    
    // Rayleigh phase function
    float rayleighPhase = 0.75 * (1.0 + VdotL * VdotL);
    
    // Sunset terminator (red/orange shift when light grazes the horizon)
    float terminator = exp(-NdotL * 6.0) * smoothstep(-0.2, 0.2, NdotL);
    vec3 sunsetColor = mix(uColor, vec3(1.0, 0.3, 0.05), terminator);
    
    vec3 scatter = sunsetColor * opticalDepth * rayleighPhase * NdotL * 1.5;
    
    // Additive rim glow for the outer halo
    float rim = pow(1.0 - NdotV, 4.0) * smoothstep(-0.1, 0.5, NdotL);
    scatter += sunsetColor * rim * 2.0;
    
    // Night side ambient
    scatter += uColor * 0.02 * (1.0 - NdotV);
    
    float alpha = clamp(max(scatter.r, max(scatter.g, scatter.b)), 0.0, 1.0);
    gl_FragColor = vec4(scatter, alpha);
  }
`;

export default function VolumetricAtmosphere({
  radius,
  color,
  starPosition = [0, 0, 0],
  scale = 1.15,
}: Props) {
  const geometry = useMemo(() => new THREE.SphereGeometry(radius, 48, 48), [radius]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uStarPos: { value: new THREE.Vector3(...starPosition) },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [color, starPosition]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <mesh scale={scale} geometry={geometry}>
      <primitive object={material} attach="material" />
    </mesh>
  );
}
