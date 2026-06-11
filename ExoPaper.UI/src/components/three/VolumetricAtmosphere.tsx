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
    float NdotL = dot(N, L);
    float VdotL = max(0.0, dot(V, L));

    // Limb-only halo: 0 over the disc (planet shows through), peaks at the silhouette.
    // This is the key to avoiding the "soap-bubble" look over the planet's face.
    float limb = pow(1.0 - NdotV, 3.5);

    // Day-lit gating with a soft terminator falloff.
    float dayLight = smoothstep(-0.35, 0.35, NdotL);

    // Wavelength-dependent Rayleigh tint, blended with the planet's climate colour.
    vec3 betaRayleigh = vec3(0.25, 0.5, 1.0);
    vec3 dayTint = mix(uColor, betaRayleigh, 0.4);

    // Reddening where the light grazes the horizon (sunset band near the terminator).
    float terminator = smoothstep(0.0, 0.4, NdotL) * smoothstep(0.75, 0.0, NdotL);
    vec3 col = mix(dayTint, vec3(1.0, 0.4, 0.12), terminator * 0.55);

    // Mie forward-scattering crescent toward the star, only at the limb.
    const float g = 0.74;
    float miePhase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * VdotL, 1.5);

    float intensity =
        limb * dayLight * 1.3            // main lit halo
      + limb * miePhase * 0.04 * dayLight // forward Mie crescent
      + limb * 0.05;                      // faint night-side limb

    intensity = clamp(intensity, 0.0, 1.0);
    gl_FragColor = vec4(col * intensity, intensity);
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
        side: THREE.FrontSide,
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
