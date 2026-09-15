"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  NoColorSpace,
  OrthographicCamera,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
} from "three";
import { SurfaceField } from "@/lib/sand/SurfaceField";
import { SAND } from "@/lib/sand/config";
import { useSandPointer } from "@/hooks/useSandPointer";
import {
  grainFragment,
  grainVertex,
  sandFragment,
  sandVertex,
} from "@/shaders/sand/surface";
import SandFallback from "./SandFallback";

export interface SandRuntime {
  field: SurfaceField;
  paused: boolean;
  hidden: boolean;
  reduced: boolean;
  onStroke: () => void;
  onGesture: () => void;
  onRelease: () => void;
  onFrame: (speed: number, active: boolean) => void;
}

export function Terrain({ runtime }: { runtime: SandRuntime }) {
  const { field } = runtime;
  const { size, camera, gl, setDpr } = useThree();
  const mat = useRef<ShaderMaterial>(null),
    grainsMat = useRef<ShaderMaterial>(null);
  const geometry = useRef<BufferGeometry>(null);
  const compact = size.width < 650;
  const texture = useMemo(() => {
    const t = new DataTexture(
      field.pixels,
      field.size,
      field.size,
      RGBAFormat,
      UnsignedByteType,
    );
    t.minFilter = t.magFilter = LinearFilter;
    t.colorSpace = NoColorSpace;
    t.needsUpdate = true;
    return t;
  }, [field]);
  const uniforms = useMemo(
    () => ({
      uField: { value: texture },
      uSize: { value: new Vector2(10.8, 7.8) },
      uResolution: { value: field.size },
      uDpr: { value: 1 },
      uPointer: { value: new Vector2() },
      uDown: { value: 0 },
      uToolRadius: { value: 0.5 },
      uShadowSamples: { value: 4 },
      uStirPosition: { value: new Vector2() },
      uStir: { value: 0 },
      uStirTime: { value: 0 },
      uGather: { value: 0 },
    }),
    [texture, field.size],
  );
  const dimensions = useMemo(() => {
    const aspect = size.width / size.height;
    const depth = compact ? 10.8 : 7.8;
    return {
      width: compact
        ? depth * aspect * 1.15
        : Math.min(15.5, depth * aspect * 1.02),
      depth,
    };
  }, [size, compact]);
  const grainGeometry = useMemo(() => {
    const count =
      field.size === SAND.lowResolution
        ? 6000
        : compact
          ? SAND.compactGrains
          : SAND.desktopGrains;
    const g = new BufferGeometry(),
      points = new Float32Array(count * 3),
      sizes = new Float32Array(count);
    let seed = 1429;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      points[i * 3] = (random() - 0.5) * dimensions.width * 0.985;
      points[i * 3 + 1] = (random() - 0.5) * dimensions.depth * 0.97;
      sizes[i] = 0.65 + random() * 1.1;
    }
    g.setAttribute("position", new BufferAttribute(points, 3));
    g.setAttribute("aSize", new BufferAttribute(sizes, 1));
    return g;
  }, [compact, dimensions, field.size]);

  useEffect(() => {
    field.end();
    field.width = dimensions.width;
    field.depth = dimensions.depth;
    if (camera instanceof OrthographicCamera) {
      camera.position.set(0, -4.3, 10.4);
      camera.lookAt(0, 0, 0);
      camera.zoom =
        (size.height * (compact ? 0.64 : 0.79)) / (dimensions.depth * 0.925);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    }
  }, [camera, size, field, dimensions, compact]);
  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );
  useEffect(
    () => () => {
      grainGeometry.dispose();
    },
    [grainGeometry],
  );

  useSandPointer(runtime);

  const profile = useRef({
    time: 0,
    frames: 0,
    slow: 0,
    tier: field.size === SAND.lowResolution ? 3 : 0,
    warmup: 2,
  });
  const stirring = useRef({ amount: 0, time: 0 });
  useFrame((_, dt) => {
    if (runtime.paused || runtime.hidden) return;
    field.step(dt);
    if (field.pack()) texture.needsUpdate = true;
    const actual = mat.current?.uniforms;
    if (actual) {
      actual.uField.value = texture;
      actual.uSize.value.set(dimensions.width, dimensions.depth);
      actual.uShadowSamples.value = profile.current.tier >= 2 ? 2 : 4;
    }
    const actualGrains = grainsMat.current?.uniforms;
    if (actualGrains) {
      const stir = stirring.current;
      stir.amount +=
        ((field.active
          ? Math.min(1, field.speed * 0.2 + (field.tool === "gather" ? 0.5 : 0))
          : 0) -
          stir.amount) *
        (1 - Math.exp(-dt * 9));
      if (field.active) stir.time += dt;
      actualGrains.uField.value = texture;
      actualGrains.uSize.value.set(dimensions.width, dimensions.depth);
      actualGrains.uDpr.value = gl.getPixelRatio();
      actualGrains.uStirPosition.value.set(
        field.tool === "gather" ? field.lagX : field.x,
        field.tool === "gather" ? field.lagY : field.y,
      );
      actualGrains.uStir.value = runtime.reduced ? 0 : stir.amount;
      actualGrains.uStirTime.value = stir.time;
      actualGrains.uGather.value = field.tool === "gather" ? 1 : 0;
    }
    field.speed *= Math.exp(-dt * 4);
    runtime.onFrame(field.speed, field.active);
    const p = profile.current;
    if (p.warmup > 0) {
      p.warmup -= dt;
      return;
    }
    p.time += dt;
    p.frames++;
    if (p.time > 3) {
      const fps = p.frames / p.time;
      if (new URLSearchParams(location.search).has("inspect"))
        console.info(
          "[LUMA V3]",
          JSON.stringify({
            fps: +fps.toFixed(1),
            width: size.width,
            height: size.height,
            dpr: gl.getPixelRatio(),
            tier: p.tier,
            grid: field.size,
            revision: field.revision,
            active: field.active,
            tool: field.tool,
            reduced: runtime.reduced,
            grains:
              grainGeometry.drawRange.count === Infinity
                ? grainGeometry.attributes.position.count
                : grainGeometry.drawRange.count,
          }),
        );
      p.slow = fps < 47 ? p.slow + 1 : 0;
      if (p.slow >= 2 && p.tier < 3) {
        p.tier++;
        setDpr(Math.max(1, gl.getPixelRatio() - 0.25));
        grainGeometry.setDrawRange(
          0,
          Math.floor(
            grainGeometry.attributes.position.count * Math.pow(0.7, p.tier),
          ),
        );
        p.slow = 0;
      }
      p.time = 0;
      p.frames = 0;
    }
  });
  return (
    <>
      <mesh>
        <planeGeometry
          ref={geometry}
          args={[
            dimensions.width,
            dimensions.depth,
            Math.min(255, field.size - 1),
            Math.min(255, field.size - 1),
          ]}
        />
        <shaderMaterial
          ref={mat}
          uniforms={uniforms}
          vertexShader={sandVertex}
          fragmentShader={sandFragment}
          transparent
        />
      </mesh>
      <points geometry={grainGeometry} frustumCulled={false}>
        <shaderMaterial
          ref={grainsMat}
          uniforms={uniforms}
          vertexShader={grainVertex}
          fragmentShader={grainFragment}
          transparent
          depthWrite={false}
        />
      </points>
    </>
  );
}

function SandWorld({
  runtime,
  running = true,
}: {
  runtime: SandRuntime;
  running?: boolean;
}) {
  const [lost, setLost] = useState(false);
  if (lost || new URLSearchParams(location.search).get("quality") === "canvas")
    return <SandFallback runtime={runtime} running={running} />;
  return (
    <Canvas
      orthographic
      camera={{ position: [0, -4.3, 10.4], near: 0.1, far: 40, zoom: 80 }}
      frameloop={running ? "always" : "never"}
      dpr={[
        1,
        new URLSearchParams(location.search).get("quality") === "low"
          ? 1
          : matchMedia("(max-width:650px)").matches
            ? SAND.compactDpr
            : SAND.maxDpr,
      ]}
      gl={{
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.85;
        gl.domElement.addEventListener(
          "webglcontextlost",
          (e) => {
            e.preventDefault();
            runtime.field.end();
            setLost(true);
          },
          { once: true },
        );
      }}
      fallback={<span>绒光沙盘需要可绘制的画布。</span>}
    >
      <Terrain runtime={runtime} />
    </Canvas>
  );
}
export default memo(SandWorld);
