"use client";
import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";

export function useAdaptiveQuality(compact: boolean) {
  const { gl, setDpr, size } = useThree();
  const [level, setLevel] = useState(0);
  const sample = useRef({ time: 0, count: 0, slowWindows: 0, warmup: 2 });
  useFrame((_, delta) => {
    if (document.hidden) return;
    if (delta > 1) { sample.current.warmup = 1; return; }
    if (sample.current.warmup > 0) { sample.current.warmup -= delta; return; }
    sample.current.time += delta; sample.current.count++;
    if (sample.current.time < 2.5) return;
    const fps = sample.current.count / sample.current.time;
    if (process.env.NODE_ENV === "development" && new URLSearchParams(location.search).has("inspect")) {
      console.info("[LUMA V2 performance]", JSON.stringify({ fps: +fps.toFixed(1), level, dpr: gl.getPixelRatio(), width: size.width, height: size.height }));
    }
    sample.current.slowWindows = fps < 47 ? sample.current.slowWindows + 1 : 0;
    if (sample.current.slowWindows >= 2 && level < 3) {
      setLevel(level + 1);
      setDpr(Math.max(1, gl.getPixelRatio() - 0.25));
      sample.current.slowWindows = 0;
    }
    sample.current.time = 0; sample.current.count = 0;
  });
  return {
    level,
    steps: compact ? [48, 40, 36, 32][level] : [64, 56, 44, 36][level],
    particles: compact ? [4096, 3072, 2048, 1024][level] : [16384, 12288, 8192, 4096][level],
  };
}
