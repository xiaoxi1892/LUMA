"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Matrix4, ShaderMaterial, Vector2, Vector3, Vector4 } from "three";
import { createSurfaceBuffers, packSurface } from "@/lib/matter/surface";
import type { MatterWorld } from "@/lib/matter/types";
import { raymarchVertex } from "@/shaders/melt/raymarch.vert";
import { raymarchFragment } from "@/shaders/melt/raymarch.frag";

export default function MeltMatter({ world, steps }: { world: MatterWorld; steps: number }) {
  const material = useRef<ShaderMaterial>(null);
  const surface = useMemo(() => createSurfaceBuffers(), []);
  const uniforms = useMemo(() => ({
    uResolution: { value: new Vector2() }, uInverseProjection: { value: new Matrix4() },
    uCameraMatrix: { value: new Matrix4() }, uViewProjection: { value: new Matrix4() }, uCamera: { value: new Vector3() },
    uBoundsMin: { value: surface.min }, uBoundsMax: { value: surface.max },
    uBalls: { value: surface.balls }, uMotion: { value: surface.motion }, uCount: { value: 0 },
    uSteps: { value: 64 }, uTime: { value: 0 }, uMotionScale: { value: 1 }, uSeed: { value: 1.7 },
    uPulse: { value: 0 }, uField: { value: 0 }, uCharge: { value: 0 }, uBloom: { value: 0 },
    uHover: { value: 0 }, uPress: { value: 0 }, uPointer: { value: new Vector3(20, 20, 0) },
    uPulseDrag: { value: new Vector3() }, uPulseAnchor: { value: new Vector3() }, uPulseLag: { value: new Vector3() },
    uRipples: { value: Array.from({ length: 5 }, () => new Vector4(0, 0, 0, -10)) },
    uRippleStrength: { value: new Float32Array(5) },
  }), [surface]);

  useFrame(({ camera, gl }) => {
    if (!material.current) return;
    packSurface(world, surface);
    const u = material.current.uniforms;
    gl.getDrawingBufferSize(u.uResolution.value);
    u.uInverseProjection.value.copy(camera.projectionMatrixInverse);
    u.uCameraMatrix.value.copy(camera.matrixWorld);
    u.uViewProjection.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    u.uCamera.value.copy(camera.position);
    u.uCount.value = surface.count; u.uSteps.value = steps;
    u.uTime.value = world.time; u.uMotionScale.value = world.reducedMotion ? 0 : 1;
    u.uSeed.value = world.seed; u.uPulse.value = world.pulseMix; u.uField.value = world.fieldMix;
    u.uCharge.value = world.charge; u.uBloom.value = world.bloom; u.uHover.value = world.hovering ? 1 : 0;
    u.uPress.value = world.pulse.press.value; u.uPointer.value.copy(world.pointer);
    u.uPulseDrag.value.copy(world.pulse.drag); u.uPulseAnchor.value.copy(world.pulse.anchor); u.uPulseLag.value.copy(world.pulse.lag);
    for (let i = 0; i < 5; i++) {
      const ripple = world.ripples[i];
      if (ripple) {
        u.uRipples.value[i].set(ripple.point.x, ripple.point.y, ripple.point.z, world.time - ripple.born);
        u.uRippleStrength.value[i] = ripple.strength;
      } else { u.uRipples.value[i].w = -10; u.uRippleStrength.value[i] = 0; }
    }
  });

  return <mesh frustumCulled={false} renderOrder={-10}>
    <planeGeometry args={[2, 2]} />
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={raymarchVertex} fragmentShader={raymarchFragment} depthWrite depthTest />
  </mesh>;
}
