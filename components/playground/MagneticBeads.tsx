"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  InstancedMesh,
  InstancedBufferAttribute,
  Object3D,
  SphereGeometry,
} from "three";
import type { PlayRuntime } from "@/lib/playground/types";
import { usePlayPointer } from "@/hooks/usePlayPointer";
import {
  beadVertex,
  beadFragment,
  shadowVertex,
  shadowFragment,
} from "@/shaders/playground/material";
import { MaterialSheet } from "./SoftCells";
export default function MagneticBeads({ runtime }: { runtime: PlayRuntime }) {
  const field = runtime.beads,
    mesh = useRef<InstancedMesh>(null),
    shadows = useRef<InstancedMesh>(null),
    dummy = useMemo(() => new Object3D(), []),
    soundTime = useRef(0);
  const geometry = useMemo(() => {
    const g = new SphereGeometry(1, 24, 18);
    g.setAttribute(
      "aSeed",
      new InstancedBufferAttribute(
        Float32Array.from(field.beads, (b) => b.seed),
        1,
      ),
    );
    return g;
  }, [field]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  usePlayPointer(runtime, field);
  useFrame((_, dt) => {
    if (runtime.paused || runtime.hidden) return;
    field.step(dt);
    field.beads.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.scale.setScalar(b.r);
      dummy.rotation.set(b.spin * 0.3, b.spin * 0.2, 0);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.set(b.x + 0.045, b.y - 0.025, 0.006);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(b.r * 3.0, b.r * 2.8, 1);
      dummy.updateMatrix();
      shadows.current?.setMatrixAt(i, dummy.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    if (shadows.current) shadows.current.instanceMatrix.needsUpdate = true;
    soundTime.current += dt;
    if (soundTime.current > 0.105) {
      if (field.collisionCount)
        runtime.onSound({
          kind: "collision",
          count: field.collisionCount,
          energy: Math.min(1, field.collisionImpulse * 0.065),
          speed: field.collisionSpeed / field.collisionCount,
        });
      field.clearAudio();
      soundTime.current = 0;
    }
  });
  return (
    <>
      <MaterialSheet
        width={runtime.width}
        depth={runtime.depth}
        membrane={0.22}
      />
      <instancedMesh
        ref={shadows}
        args={[undefined, undefined, field.beads.length]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          vertexShader={shadowVertex}
          fragmentShader={shadowFragment}
          transparent
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={mesh}
        args={[geometry, undefined, field.beads.length]}
        frustumCulled={false}
      >
        <shaderMaterial
          vertexShader={beadVertex}
          fragmentShader={beadFragment}
        />
      </instancedMesh>
    </>
  );
}
