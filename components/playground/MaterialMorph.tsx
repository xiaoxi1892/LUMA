"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  RGBAFormat,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  Vector2,
  Vector3,
} from "three";
import type { PlayRuntime } from "@/lib/playground/types";
import {
  morphSurfaceVertex,
  morphSurfaceFragment,
  morphBodyVertex,
  morphBodyFragment,
  morphGrainVertex,
  grainFragment,
} from "@/shaders/playground/transition";
/** A temporary, single material bridge. CPU histories are read-only throughout. */
export default function MaterialMorph({ runtime }: { runtime: PlayRuntime }) {
  const { gl } = useThree(),
    surface = useRef<ShaderMaterial>(null),
    bodies = useRef<ShaderMaterial>(null),
    grains = useRef<ShaderMaterial>(null);
  const data = useMemo(() => {
    const f = runtime.sand.field;
    f.pack();
    const texture = new DataTexture(
      f.pixels,
      f.size,
      f.size,
      RGBAFormat,
      UnsignedByteType,
    );
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    const base = new SphereGeometry(1, 32, 24),
      body = new InstancedBufferGeometry();
    body.index = base.index;
    body.attributes.position = base.attributes.position;
    body.attributes.normal = base.attributes.normal;
    const count = Math.max(
      runtime.bubble.cells.length,
      runtime.beads.beads.length,
    );
    body.instanceCount = count;
    const cells = new Float32Array(count * 4),
      touch = new Float32Array(count * 4),
      beads = new Float32Array(count * 4),
      extra = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const c = runtime.bubble.cells[i % runtime.bubble.cells.length],
        b = runtime.beads.beads[i % runtime.beads.beads.length];
      cells.set([c.x, c.y, c.radius, c.depth], i * 4);
      touch.set([c.touchX, c.touchY, c.bendX, c.bendY], i * 4);
      beads.set(
        [b.x, b.y, b.z, i < runtime.beads.beads.length ? b.r : 0],
        i * 4,
      );
      extra.set([b.seed, i < runtime.bubble.cells.length ? 1 : 0], i * 2);
    }
    body.setAttribute("aCell", new InstancedBufferAttribute(cells, 4));
    body.setAttribute("aTouch", new InstancedBufferAttribute(touch, 4));
    body.setAttribute("aBead", new InstancedBufferAttribute(beads, 4));
    body.setAttribute("aExtra", new InstancedBufferAttribute(extra, 2));
    const points = new BufferGeometry(),
      n = runtime.width < 7 ? 10000 : 28000,
      pos = new Float32Array(n * 3),
      attract = new Float32Array(n * 3),
      sizes = new Float32Array(n);
    let seed = 1429;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < n; i++) {
      const x = (random() - 0.5) * runtime.width * 0.985,
        y = (random() - 0.5) * runtime.depth * 0.97;
      pos.set([x, y, 0], i * 3);
      sizes[i] = 0.65 + random() * 1.1;
      const target =
        runtime.transition.from === "beads" || runtime.transition.to === "beads"
          ? runtime.beads.beads
          : runtime.bubble.cells;
      let nearest = target[0],
        best = Infinity;
      for (const c of target) {
        const dist = (c.x - x) ** 2 + (c.y - y) ** 2;
        if (dist < best) {
          best = dist;
          nearest = c;
        }
      }
      attract.set(
        [nearest.x, nearest.y, "z" in nearest ? nearest.z : 0.2],
        i * 3,
      );
    }
    points.setAttribute("position", new BufferAttribute(pos, 3));
    points.setAttribute("aAttractor", new BufferAttribute(attract, 3));
    points.setAttribute("aSize", new BufferAttribute(sizes, 1));
    return { texture, body, points };
  }, [runtime]);
  const uniforms = useMemo(
    () => ({
      uWeights: { value: new Vector3(...runtime.transition.weights()) },
      uSand: { value: 1 },
      uBubble: { value: 0 },
      uField: { value: data.texture },
      uSize: { value: new Vector2(runtime.width, runtime.depth) },
      uResolution: { value: runtime.sand.field.size },
      uShadowSamples: { value: 4 },
      uPointer: { value: new Vector2() },
      uDown: { value: 0 },
      uToolRadius: { value: 0.5 },
      uDpr: { value: 1 },
    }),
    [runtime, data],
  );
  useEffect(
    () => () => {
      data.texture.dispose();
      data.body.dispose();
      data.points.dispose();
    },
    [data],
  );
  useFrame((_, dt) => {
    if (runtime.paused || runtime.hidden) return;
    runtime.transition.step(dt);
    const w = runtime.transition.weights();
    for (const ref of [surface, bodies, grains]) {
      const u = ref.current?.uniforms;
      if (!u) continue;
      u.uWeights.value.set(...w);
      u.uSand.value = w[0];
      u.uBubble.value = w[1];
      u.uDpr.value = gl.getPixelRatio();
      u.uField.value = data.texture;
    }
    if (!runtime.transition.active) runtime.onTransitionEnd();
  });
  return (
    <>
      <mesh>
        <planeGeometry args={[runtime.width, runtime.depth, 255, 255]} />
        <shaderMaterial
          ref={surface}
          uniforms={uniforms}
          transparent
          vertexShader={morphSurfaceVertex}
          fragmentShader={morphSurfaceFragment}
        />
      </mesh>
      <mesh geometry={data.body} frustumCulled={false}>
        <shaderMaterial
          ref={bodies}
          uniforms={uniforms}
          vertexShader={morphBodyVertex}
          fragmentShader={morphBodyFragment}
        />
      </mesh>
      <points geometry={data.points} frustumCulled={false}>
        <shaderMaterial
          ref={grains}
          uniforms={uniforms}
          vertexShader={morphGrainVertex}
          fragmentShader={grainFragment}
          transparent
          depthWrite={false}
        />
      </points>
    </>
  );
}
