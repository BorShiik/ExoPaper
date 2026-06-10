import { EffectComposer, Bloom, Vignette, ToneMapping, SMAA } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

interface Props {
  /** SMAA is the priciest pass — disable on low quality. */
  smaa?: boolean;
  bloomThreshold?: number;
  bloomIntensity?: number;
  bloomRadius?: number;
  vignetteOffset?: number;
  vignetteDarkness?: number;
}

/**
 * Post-processing stack, isolated into its own module so it can be lazy-loaded —
 * `@react-three/postprocessing` is large and shouldn't sit in the initial bundle.
 */
export default function ScenePostFX({
  smaa = true,
  bloomThreshold = 1.0,
  bloomIntensity = 0.85,
  bloomRadius = 0.85,
  vignetteOffset = 0.15,
  vignetteDarkness = 0.9,
}: Props) {
  return (
    <EffectComposer multisampling={0}>
      {smaa ? <SMAA /> : <></>}
      <Bloom luminanceThreshold={bloomThreshold} intensity={bloomIntensity} mipmapBlur radius={bloomRadius} />
      <Vignette eskil={false} offset={vignetteOffset} darkness={vignetteDarkness} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
