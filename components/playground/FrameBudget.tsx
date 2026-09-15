"use client";
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PlayRuntime } from "@/lib/playground/types";
/** Consecutive slow windows lower pixel work. Material history is never resampled. */
export default function FrameBudget({ runtime }: { runtime: PlayRuntime }) {
  const { gl, setDpr, size } = useThree(),
    profile = useRef({
      time: 0,
      frames: 0,
      slow: 0,
      warmup: 2,
      tier: 0,
      mode: "",
    });
  useFrame((_, dt) => {
    if (runtime.hidden || runtime.paused) return;
    const p = profile.current;
    // A background/resume, debugger pause or blocked main thread is a clock
    // discontinuity, not a steady rendering window. Never adapt from that gap.
    if (dt > 0.25) {
      p.time = 0;
      p.frames = 0;
      p.warmup = 0.5;
      return;
    }
    if (p.mode !== runtime.mode || runtime.transition.active) {
      p.mode = runtime.mode;
      p.time = 0;
      p.frames = 0;
      p.warmup = 0.5;
      return;
    }
    if (p.warmup > 0) {
      p.warmup -= dt;
      return;
    }
    p.time += dt;
    p.frames++;
    if (p.time < 3) return;
    const fps = p.frames / p.time;
    if (new URLSearchParams(location.search).has("inspect"))
      console.info(
        "[LUMA materials]",
        JSON.stringify({
          mode: runtime.mode,
          fps: +fps.toFixed(1),
          width: size.width,
          height: size.height,
          dpr: gl.getPixelRatio(),
          tier: p.tier,
          cells: runtime.bubble.cells.length,
          beads: runtime.beads.beads.length,
          presses: runtime.bubble.presses,
          waves: runtime.bubble.waveCount,
          throws: runtime.beads.throws,
          revision: runtime.sand.field.revision,
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
        }),
      );
    p.slow = fps < 48 ? p.slow + 1 : 0;
    if (p.slow >= 2 && p.tier < 3) {
      p.tier++;
      p.slow = 0;
      setDpr(Math.max(1, gl.getPixelRatio() - 0.25));
      runtime.quality = p.tier;
    }
    p.time = 0;
    p.frames = 0;
  });
  return null;
}
