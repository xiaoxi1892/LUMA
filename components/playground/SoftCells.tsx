"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  PlaneGeometry,
  Vector2,
  Vector4,
  ShaderMaterial,
} from "three";
import type { PlayRuntime } from "@/lib/playground/types";
import { usePlayPointer } from "@/hooks/usePlayPointer";
import {
  cellVertex,
  cellFragment,
  sheetVertex,
  sheetFragment,
} from "@/shaders/playground/material";
export function MaterialSheet({
  width,
  depth,
  membrane = 1,
  runtime,
}: {
  width: number;
  depth: number;
  membrane?: number;
  runtime?: PlayRuntime;
}) {
  const mat = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uSize: { value: new Vector2(width, depth) },
      uMembrane: { value: membrane },
      uPress: { value: new Vector4() },
      uWave: { value: new Vector4(0, 0, 10, 0) },
    }),
    [width, depth, membrane],
  );
  useFrame(() => {
    const u = mat.current?.uniforms;
    if (!u || !runtime) return;
    const field = runtime.bubble;
    u.uPress.value.set(
      field.x,
      field.y,
      field.active ? Math.min(0.7, field.held * 0.3) : 0,
      0,
    );
    const w = field.waves[field.waves.length - 1];
    if (w) u.uWave.value.set(w.x, w.y, field.time - w.time, w.strength);
  });
  return (
    <mesh position-z={-0.015}>
      <planeGeometry args={[width, depth, 64, 64]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={sheetVertex}
        fragmentShader={sheetFragment}
      />
    </mesh>
  );
}
export default function SoftCells({ runtime }: { runtime: PlayRuntime }) {
  const field = runtime.bubble;
  const count = field.cells.length;
  const detail = runtime.width < 7 ? 24 : 32;
  const geometry = useMemo(() => {
    const base = new PlaneGeometry(1, 1, detail, detail),
      g = new InstancedBufferGeometry();
    g.index = base.index;
    g.attributes.position = base.attributes.position;
    g.attributes.uv = base.attributes.uv;
    g.instanceCount = count;
    g.setAttribute(
      "aCell",
      new InstancedBufferAttribute(new Float32Array(count * 4), 4),
    );
    g.setAttribute(
      "aTouch",
      new InstancedBufferAttribute(new Float32Array(count * 4), 4),
    );
    g.setAttribute(
      "aMemory",
      new InstancedBufferAttribute(new Float32Array(count), 1),
    );
    return g;
  }, [count, detail]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  usePlayPointer(runtime, field);
  const sound = useRef({ presses: field.presses, release: 0 });
  useFrame((_, dt) => {
    if (runtime.paused || runtime.hidden) return;
    field.step(dt, runtime.reduced);
    const cell = geometry.getAttribute("aCell"),
      touch = geometry.getAttribute("aTouch"),
      memory = geometry.getAttribute("aMemory");
    field.cells.forEach((c, i) => {
      cell.setXYZW(i, c.x, c.y, c.radius, c.depth);
      touch.setXYZW(i, c.touchX, c.touchY, c.bendX, c.bendY);
      memory.setX(i, c.memory);
    });
    cell.needsUpdate = touch.needsUpdate = memory.needsUpdate = true;
    if (field.presses > sound.current.presses) {
      runtime.onSound({
        kind: "press",
        energy: 0.25 + field.speed * 0.045,
        count: field.presses - sound.current.presses,
        speed: field.speed,
      });
      sound.current.presses = field.presses;
    }
    if (field.releaseEnergy > 0) {
      runtime.onSound({
        kind: "release",
        energy: field.releaseEnergy,
        count: 1,
        speed: 0,
      });
      field.releaseEnergy = 0;
    }
  });
  return (
    <>
      <MaterialSheet
        width={runtime.width}
        depth={runtime.depth}
        runtime={runtime}
      />
      <mesh geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          vertexShader={cellVertex}
          fragmentShader={cellFragment}
        />
      </mesh>
    </>
  );
}
