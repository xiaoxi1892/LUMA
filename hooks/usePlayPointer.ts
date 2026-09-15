"use client";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { PointerVelocity } from "./usePointerVelocity";
import type { PlayRuntime } from "@/lib/playground/types";
export interface PointerTarget {
  begin(x: number, y: number): void;
  move(x: number, y: number, speed: number): void;
  end(release?: boolean, vx?: number, vy?: number): void;
}
export function usePlayPointer(runtime: PlayRuntime, target: PointerTarget) {
  const { gl, camera } = useThree();
  useEffect(() => {
    const el = gl.domElement,
      ray = new Raycaster(),
      plane = new Plane(new Vector3(0, 0, 1), -0.22),
      point = new Vector3(),
      ndc = new Vector2(),
      velocity = new PointerVelocity();
    let id: number | null = null,
      keyboard = false,
      kx = 0,
      ky = 0,
      lastMove = 0;
    const project = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      ndc.set(
        ((e.clientX - b.left) / b.width) * 2 - 1,
        1 - ((e.clientY - b.top) / b.height) * 2,
      );
      ray.setFromCamera(ndc, camera);
      ray.ray.intersectPlane(plane, point);
      point.x = Math.max(
        -runtime.width * 0.48,
        Math.min(runtime.width * 0.48, point.x),
      );
      point.y = Math.max(
        -runtime.depth * 0.48,
        Math.min(runtime.depth * 0.48, point.y),
      );
    };
    const end = (release = true) => {
      if (id === null && !keyboard) return;
      const old = id;
      id = null;
      keyboard = false;
      const fresh = performance.now() - lastMove < 120;
      target.end(
        release,
        fresh ? velocity.value.x : 0,
        fresh ? velocity.value.y : 0,
      );
      if (old !== null && el.hasPointerCapture(old))
        el.releasePointerCapture(old);
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || id !== null || runtime.paused || runtime.hidden)
        return;
      e.preventDefault();
      project(e);
      id = e.pointerId;
      el.setPointerCapture(id);
      el.focus({ preventScroll: true });
      velocity.reset(point, e.timeStamp);
      lastMove = performance.now();
      target.begin(point.x, point.y);
      runtime.onGesture();
      runtime.onStroke();
    };
    const move = (e: PointerEvent) => {
      if (
        runtime.paused ||
        runtime.hidden ||
        (id !== null && id !== e.pointerId)
      )
        return;
      project(e);
      velocity.update(point, e.timeStamp);
      lastMove = performance.now();
      target.move(point.x, point.y, velocity.value.length());
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === id) end();
    };
    const cancel = () => end(false);
    const key = (e: KeyboardEvent) => {
      if (runtime.paused || runtime.hidden) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!keyboard) {
          keyboard = true;
          target.begin(kx, ky);
          runtime.onGesture();
          runtime.onStroke();
        }
        return;
      }
      const dirs: Record<string, [number, number]> = {
        ArrowLeft: [-0.22, 0],
        ArrowRight: [0.22, 0],
        ArrowUp: [0, 0.22],
        ArrowDown: [0, -0.22],
      };
      if (!dirs[e.key]) return;
      e.preventDefault();
      kx = Math.max(
        -runtime.width * 0.45,
        Math.min(runtime.width * 0.45, kx + dirs[e.key][0]),
      );
      ky = Math.max(
        -runtime.depth * 0.45,
        Math.min(runtime.depth * 0.45, ky + dirs[e.key][1]),
      );
      target.move(kx, ky, 2);
    };
    const keyup = (e: KeyboardEvent) => {
      if (e.code === "Space") end();
    };
    el.setAttribute("tabindex", "0");
    el.setAttribute(
      "aria-label",
      runtime.mode === "bubble"
        ? "柔软膜片。按住或划动，方向键定位，空格按压。"
        : "磁力珠。按住吸引，拖动后松开甩出。方向键定位，空格吸引。",
    );
    const listeners: [string, EventListener][] = [
      ["pointerdown", down as EventListener],
      ["pointermove", move as EventListener],
      ["pointerup", up as EventListener],
      ["pointercancel", cancel],
      ["lostpointercapture", cancel],
      ["keydown", key as EventListener],
      ["keyup", keyup as EventListener],
      ["blur", cancel],
    ];
    for (const [name, fn] of listeners) el.addEventListener(name, fn);
    window.addEventListener("pointerup", up);
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      for (const [name, fn] of listeners) el.removeEventListener(name, fn);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("blur", cancel);
    };
  }, [runtime, target, gl, camera]);
}
