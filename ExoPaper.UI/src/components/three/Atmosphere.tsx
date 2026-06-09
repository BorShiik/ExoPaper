import { useMemo, useEffect } from "react";
import * as THREE from "three";

interface Props {
  /** Base planet radius (the atmosphere shell is rendered slightly larger). */
  radius: number;
  /** Glow color (CSS string or hex number). */
  color: THREE.ColorRepresentation;
  /** Fresnel falloff exponent — higher = thinner rim. */
  power?: number;
  /** Overall brightness of the rim. */
  intensity?: number;
  /** Shell scale relative to the planet radius. */
  scale?: number;
  /** World-space position of the illuminating star (planets orbit the origin). */
  starPosition?: [number, number, number];
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

// Fresnel rim modulated by the day-side: scattering is bright on the limb that
// faces the star and fades through the terminator into the night side, with a
// faint warm tint near the terminator (Rayleigh-ish). This removes the flat,
// uniform "neon halo" look.
const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uStarPos;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vPositionW);
    vec3 lightDir = normalize(uStarPos - vPositionW);

    float fresnel = pow(1.0 - abs(dot(N, viewDir)), uPower);
    float dayside = clamp(dot(N, lightDir), 0.0, 1.0);
    float scatter = pow(dayside, 0.65);

    // Warm tint right at the terminator, cool color on the bright limb.
    float terminator = pow(1.0 - dayside, 4.0) * scatter;
    vec3 tint = mix(uColor, uColor.brg * 1.1, terminator * 0.5);

    float glow = fresnel * (0.08 + 0.92 * scatter);
    gl_FragColor = vec4(tint * uIntensity, glow);
  }
`;

/**
 * Atmospheric rim-light using a Fresnel term on a back-facing shell, modulated by
 * the star direction so the glow looks physically plausible (sunlit limb glows,
 * night side stays dark). Additive + depth-write off so it never occludes the
 * planet surface.
 */
export default function Atmosphere({
  radius,
  color,
  power = 3.5,
  intensity = 0.9,
  scale = 1.13,
  starPosition = [0, 0, 0],
}: Props) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uStarPos: { value: new THREE.Vector3(...starPosition) },
          uPower: { value: power },
          uIntensity: { value: intensity },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [color, power, intensity, starPosition]
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh scale={scale}>
      <sphereGeometry args={[radius, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
