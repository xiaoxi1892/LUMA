"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping, PerspectiveCamera } from "three";
import BlobMesh from "./BlobMesh";
import type { InteractionPhase } from "@/hooks/useBlobInteraction";

function AdaptiveQuality({ onReady, onError }: { onReady: () => void; onError: () => void }) {
  const { size, camera, setDpr, gl } = useThree();
  const frames = useRef({ time: 0, count: 0, lowered: false, ready: false });
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onError(); };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onError]);
  useEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      // Keep the object comfortable on narrow screens without changing physics units.
      camera.position.z = size.width / size.height < 0.8 ? 4.65 / (size.width / size.height) : 7.15;
      camera.updateProjectionMatrix();
    }
  }, [camera, size]);
  useFrame((_, delta) => {
    if (!frames.current.ready) { frames.current.ready = true; onReady(); }
    if (document.hidden || delta > 0.15 || frames.current.lowered) return;
    frames.current.time += delta;
    frames.current.count++;
    if (frames.current.count >= 150) {
      const fps = frames.current.count / frames.current.time;
      if (process.env.NODE_ENV === "development" && new URLSearchParams(location.search).has("inspect")) {
        console.info("[LUMA performance]", JSON.stringify({ fps: Number(fps.toFixed(1)), dpr: gl.getPixelRatio(), width: size.width, height: size.height }));
      }
      if (fps < 45) {
        setDpr(Math.max(1, gl.getPixelRatio() * 0.75));
        frames.current.lowered = true;
      }
      frames.current.count = 0;
      frames.current.time = 0;
    }
  });
  return null;
}

export default function Scene({ onPhase, onReady, onError }: {
  onPhase: (phase: InteractionPhase) => void;
  onReady: () => void;
  onError: () => void;
}) {
  const [compact] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse), (max-width: 640px)").matches);
  const handleCreated = useCallback(({ gl }: { gl: import("three").WebGLRenderer }) => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.08;
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 7.15], fov: 35, near: 0.1, far: 30 }}
      dpr={[1, compact ? 1.5 : 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={handleCreated}
      fallback={<span>A soft, interactive 3D sculpture. Please use a browser with WebGL support.</span>}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[-3, 4, 5]} intensity={2.4} color="#fff1dc" />
      <directionalLight position={[4, 1, -2]} intensity={1.2} color="#d0e0ed" />
      <BlobMesh compact={compact} onPhase={onPhase} />
      <AdaptiveQuality onReady={onReady} onError={onError} />
    </Canvas>
  );
}
