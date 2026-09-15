"use client";
import { useEffect, useRef } from "react";
import type { SandRuntime } from "./SandWorld";

/** Low capability route uses the SAME persistent field and tools in Canvas 2D. */
export default function SandFallback({
  runtime,
  running,
}: {
  runtime: SandRuntime;
  running: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d", { alpha: false });
    if (!ctx) return;
    const field = runtime.field,
      n = field.size;
    el.width = n;
    el.height = n;
    const bounds = el.getBoundingClientRect();
    field.width = (field.depth * bounds.width) / bounds.height;
    const image = ctx.createImageData(n, n);
    let raf = 0,
      last = performance.now(),
      pointer: number | null = null;
    let px = 0,
      py = 0,
      stamp = 0;
    const render = () => {
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const k = j * n + i,
            h = field.height[k] + field.lift[k];
          const dx =
            ((field.height[j * n + Math.min(n - 1, i + 1)] -
              field.height[j * n + Math.max(0, i - 1)]) *
              n) /
            field.width;
          const dy =
            ((field.height[Math.min(n - 1, j + 1) * n + i] -
              field.height[Math.max(0, j - 1) * n + i]) *
              n) /
            field.depth;
          const grain = (Math.sin(k * 127.1) * 43758.54) % 1;
          const light =
            Math.max(
              0.16,
              Math.min(0.8, 0.38 - dx * 0.7 + dy * 0.35 + h * 0.2),
            ) +
            grain * 0.04;
          const p = ((n - 1 - j) * n + i) * 4;
          image.data[p] = light * 219;
          image.data[p + 1] = light * 236;
          image.data[p + 2] = light * 247;
          image.data[p + 3] = 255;
        }
      ctx.putImageData(image, 0, 0);
      field.dirty = false;
    };
    const frame = () => {
      const now = performance.now(),
        dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (running && !runtime.paused && !runtime.hidden) {
        field.step(dt);
        field.speed *= Math.exp(-dt * 4);
        runtime.onFrame(field.speed, field.active);
        if (field.dirty) render();
      }
      if (running) raf = requestAnimationFrame(frame);
    };
    const point = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width - 0.5) * field.width,
        y: (0.5 - (e.clientY - r.top) / r.height) * field.depth,
      };
    };
    const end = () => {
      const old = pointer;
      pointer = null;
      if (field.active) runtime.onRelease();
      field.end();
      if (old !== null && el.hasPointerCapture(old))
        el.releasePointerCapture(old);
    };
    const down = (e: PointerEvent) => {
      if (!running || runtime.paused || pointer !== null || e.button !== 0)
        return;
      e.preventDefault();
      const p = point(e);
      pointer = e.pointerId;
      el.setPointerCapture(pointer);
      px = p.x;
      py = p.y;
      stamp = e.timeStamp;
      field.begin(p.x, p.y, field.tool);
      runtime.onGesture();
      runtime.onStroke();
    };
    const move = (e: PointerEvent) => {
      if (pointer !== e.pointerId || runtime.paused) return;
      e.preventDefault();
      const p = point(e),
        speed =
          Math.hypot(p.x - px, p.y - py) /
          Math.max(0.004, (e.timeStamp - stamp) / 1000);
      field.move(p.x, p.y, speed);
      px = p.x;
      py = p.y;
      stamp = e.timeStamp;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === pointer) end();
    };
    render();
    if (running) raf = requestAnimationFrame(frame);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", end);
    window.addEventListener("blur", end);
    return () => {
      cancelAnimationFrame(raf);
      end();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerleave", end);
      window.removeEventListener("blur", end);
    };
  }, [runtime, running]);
  return (
    <canvas
      className="sand-cpu"
      ref={canvas}
      aria-label="绒光沙盘，兼容绘制模式。按住拖动使用工具。"
    />
  );
}
