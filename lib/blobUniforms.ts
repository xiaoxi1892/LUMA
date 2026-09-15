import type { ShaderMaterial } from "three";
import type { BlobState } from "./blobPhysics.ts";

export function createBlobUniforms(state: BlobState) {
  return {
    uTime: { value: 0 }, uMotion: { value: 1 },
    uAnchor: { value: state.anchor }, uHoverPoint: { value: state.hoverPoint },
    uDrag: { value: state.drag }, uLag: { value: state.lag }, uCenter: { value: state.center },
    uPress: { value: 0 }, uProximity: { value: 0 },
    uReleaseTime: { value: -10 }, uReleaseStrength: { value: 0 },
  };
}

/** Write into the mounted material, never the JSX uniforms prop.
 * R3F preserves its own uniform wrappers, copying values from the prop on mount.
 * Updating that prop's numeric values later does not update the GPU material.
 */
export function syncBlobUniforms(material: ShaderMaterial, state: BlobState) {
  const target = material.uniforms;
  target.uTime.value = state.time;
  target.uMotion.value = state.reducedMotion ? 0 : 1;
  target.uPress.value = state.press.value;
  target.uProximity.value = state.proximity;
  target.uReleaseTime.value = state.releaseTime;
  target.uReleaseStrength.value = state.releaseStrength;
  target.uAnchor.value.copy(state.anchor);
  target.uHoverPoint.value.copy(state.hoverPoint);
  target.uDrag.value.copy(state.drag);
  target.uLag.value.copy(state.lag);
  target.uCenter.value.copy(state.center);
}
