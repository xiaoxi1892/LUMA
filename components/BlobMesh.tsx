"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ShaderMaterial } from "three";
import { createBlobState, stepBlob } from "@/lib/blobPhysics";
import { createBlobUniforms, syncBlobUniforms } from "@/lib/blobUniforms";
import { useBlobInteraction, type InteractionPhase } from "@/hooks/useBlobInteraction";
import { blobVertexShader } from "@/shaders/blob.vert";
import { blobFragmentShader } from "@/shaders/blob.frag";

export default function BlobMesh({ compact, onPhase }: { compact: boolean; onPhase: (phase: InteractionPhase) => void }) {
  const state = useMemo(() => createBlobState(), []);
  const uniforms = useMemo(() => createBlobUniforms(state), [state]);
  const material = useRef<ShaderMaterial>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { state.reducedMotion = media.matches; };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [state]);

  useFrame((_, delta) => {
    state.time += Math.min(delta, 0.05);
    stepBlob(state, delta);
    if (material.current) syncBlobUniforms(material.current, state);
  }, -2);

  useBlobInteraction(state, onPhase);

  return (
    <mesh frustumCulled={false}>
      <sphereGeometry args={[1, compact ? 64 : 112, compact ? 48 : 80]} />
      <shaderMaterial ref={material} vertexShader={blobVertexShader} fragmentShader={blobFragmentShader} uniforms={uniforms} />
    </mesh>
  );
}
