"use client";
import { memo, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping, OrthographicCamera } from "three";
import { Terrain } from "@/components/sand/SandWorld";
import FrameBudget from "./FrameBudget";
import MaterialMorph from "./MaterialMorph";
import MagneticBeads from "./MagneticBeads";
import SoftCells from "./SoftCells";
import { worldDimensions, type PlayRuntime } from "@/lib/playground/types";
function WorldContent({
  runtime,
  mode,
}: {
  runtime: PlayRuntime;
  mode: string;
}) {
  const { size, camera } = useThree(),
    d = worldDimensions(size.width, size.height);
  runtime.width = d.width;
  runtime.depth = d.depth;
  runtime.bubble.layout(d.width, d.depth);
  runtime.beads.layout(d.width, d.depth);
  useEffect(() => {
    if (camera instanceof OrthographicCamera) {
      camera.position.set(0, -4.3, 10.4);
      camera.lookAt(0, 0, 0);
      camera.zoom =
        (size.height * (d.compact ? 0.64 : 0.79)) / (d.depth * 0.925);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    }
  }, [camera, size, d.compact, d.depth]);
  return (
    <>
      <FrameBudget runtime={runtime} />
      {mode === "transition" ? (
        <MaterialMorph key={`${d.width}-${d.depth}`} runtime={runtime} />
      ) : mode === "sand" ? (
        <Terrain runtime={runtime.sand} />
      ) : mode === "bubble" ? (
        <SoftCells runtime={runtime} />
      ) : (
        <MagneticBeads runtime={runtime} />
      )}
    </>
  );
}
function PlayWorld({
  runtime,
  mode,
  running,
}: {
  runtime: PlayRuntime;
  mode: string;
  running: boolean;
}) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, -4.3, 10.4], near: 0.1, far: 40, zoom: 80 }}
      dpr={[
        1,
        new URLSearchParams(location.search).get("quality") === "low"
          ? 1
          : matchMedia("(max-width:650px)").matches
            ? 1.25
            : 1.75,
      ]}
      frameloop={running ? "always" : "never"}
      gl={{
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.95;
      }}
      fallback={<span>此体验需要支持 WebGL 的浏览器。</span>}
    >
      <WorldContent runtime={runtime} mode={mode} />
    </Canvas>
  );
}
export default memo(PlayWorld);
