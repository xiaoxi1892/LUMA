"use client";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { PointerVelocity } from "./usePointerVelocity";
import type { SandRuntime } from "@/components/sand/SandWorld";

/** One capture lifecycle for mouse, pen and touch. No delayed input queue. */
export function useSandPointer(runtime: SandRuntime) {
  const { gl, camera } = useThree();
  useEffect(() => {
    const field = runtime.field,
      el = gl.domElement,
      ray = new Raycaster(),
      plane = new Plane(new Vector3(0, 0, 1), 0);
    const ndc = new Vector2(),
      point = new Vector3(),
      velocity = new PointerVelocity();
    let pointer: number | null = null,
      keyboard = false,
      kx = 0,
      ky = 0;
    const project = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      ndc.set(
        ((e.clientX - box.left) / box.width) * 2 - 1,
        1 - ((e.clientY - box.top) / box.height) * 2,
      );
      ray.setFromCamera(ndc, camera);
      ray.ray.intersectPlane(plane, point);
      return (
        Math.abs(point.x) <= field.width / 2 - 0.04 &&
        Math.abs(point.y) <= field.depth / 2 - 0.04
      );
    };
    const end = () => {
      const previous = pointer;
      pointer = null;
      keyboard = false;
      if (field.active) runtime.onRelease();
      field.end();
      if (previous !== null && el.hasPointerCapture(previous))
        el.releasePointerCapture(previous);
    };
    const down = (e: PointerEvent) => {
      if (
        e.button !== 0 ||
        pointer !== null ||
        runtime.paused ||
        runtime.hidden ||
        !project(e)
      )
        return;
      e.preventDefault();
      pointer = e.pointerId;
      el.setPointerCapture(pointer);
      el.focus({ preventScroll: true });
      velocity.reset(point, e.timeStamp);
      field.begin(point.x, point.y, field.tool);
      runtime.onGesture();
      runtime.onStroke();
    };
    const move = (e: PointerEvent) => {
      if (pointer !== e.pointerId || runtime.paused || runtime.hidden) return;
      if (!project(e)) {
        end();
        return;
      }
      e.preventDefault();
      velocity.update(point, e.timeStamp);
      field.move(point.x, point.y, velocity.value.length());
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === pointer) end();
    };
    const key = (e: KeyboardEvent) => {
      if (runtime.paused || runtime.hidden) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!keyboard) {
          keyboard = true;
          field.begin(kx, ky, field.tool);
          runtime.onGesture();
          runtime.onStroke();
        }
        return;
      }
      const direction: { [key: string]: [number, number] } = {
        ArrowLeft: [-0.12, 0],
        ArrowRight: [0.12, 0],
        ArrowUp: [0, 0.12],
        ArrowDown: [0, -0.12],
      };
      if (!direction[e.key]) return;
      e.preventDefault();
      kx = Math.max(
        -field.width * 0.45,
        Math.min(field.width * 0.45, kx + direction[e.key][0]),
      );
      ky = Math.max(
        -field.depth * 0.45,
        Math.min(field.depth * 0.45, ky + direction[e.key][1]),
      );
      if (keyboard) field.move(kx, ky, 1.8);
    };
    const keyup = (e: KeyboardEvent) => {
      if (e.code === "Space") end();
    };
    const visibility = () => {
      if (document.hidden) end();
    };
    el.setAttribute("tabindex", "0");
    el.setAttribute(
      "aria-label",
      "绒光沙盘。按住拖动。键盘方向键定位，按住空格和方向键绘制，Escape 暂停。",
    );
    const listeners: [string, EventListener][] = [
      ["pointerdown", down as EventListener],
      ["pointermove", move as EventListener],
      ["pointerup", up as EventListener],
      ["pointercancel", up as EventListener],
      ["lostpointercapture", end],
      ["pointerleave", end],
      ["keydown", key as EventListener],
      ["keyup", keyup as EventListener],
      ["blur", end],
    ];
    for (const [event, listener] of listeners)
      el.addEventListener(event, listener);
    window.addEventListener("blur", end);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      end();
      for (const [event, listener] of listeners)
        el.removeEventListener(event, listener);
      window.removeEventListener("blur", end);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [gl, camera, runtime]);
}
