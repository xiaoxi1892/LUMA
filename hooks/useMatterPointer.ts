"use client";
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { PointerVelocity } from "./usePointerVelocity";
import { grabMatter, moveGrab, releaseMatter, splitMatter } from "@/lib/matter/actions";
import { createSurfaceBuffers, packSurface, pickSurface } from "@/lib/matter/surface";
import type { MatterWorld } from "@/lib/matter/types";

export function useMatterPointer(world: MatterWorld, wakeAudio: () => void) {
  const { gl, camera } = useThree();
  const surface = useMemo(() => createSurfaceBuffers(), []);
  useEffect(() => {
    const canvas = gl.domElement;
    const host = canvas.closest<HTMLElement>(".matter-surface") ?? canvas;
    const raycaster = new Raycaster(), ndc = new Vector2();
    const plane = new Plane(new Vector3(0, 0, 1), 0), point = new Vector3();
    const velocity = new PointerVelocity();
    let active: number | null = null, keyboardHeld = false, previousTap = -1000;
    let tapX = 0, tapY = 0, moved = 0;
    const now = () => performance.now();
    function aim(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      world.pointerNdc.copy(ndc);
      raycaster.setFromCamera(ndc, camera);
    }
    function pick() { packSurface(world, surface); return pickSurface(raycaster.ray, world, surface); }
    function cursor(state: string) { host.dataset.pointer = state; }
    function down(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0 || active !== null) return;
      wakeAudio(); aim(event);
      const hit = pick();
      if (!hit && world.mode !== "FIELD") return;
      event.preventDefault();
      active = event.pointerId; canvas.setPointerCapture(active);
      host.focus({ preventScroll: true });
      plane.constant = hit ? -hit.point.z : 0;
      raycaster.ray.intersectPlane(plane, point);
      world.pointer.copy(point);
      velocity.reset(point, now());
      grabMatter(world, hit?.id ?? world.bodies[0].id, point, hit?.normal ?? new Vector3(0, 0, 1));
      moved = 0; cursor("down");
    }
    function move(event: PointerEvent) {
      if (!event.isPrimary || (active !== null && event.pointerId !== active)) return;
      aim(event);
      world.pointerInside = true;
      if (active !== null) {
        if (raycaster.ray.intersectPlane(plane, point)) {
          velocity.update(point, now()); moveGrab(world, point, velocity.value);
          moved = Math.max(moved, world.grip?.distance ?? 0);
          cursor(moved > 0.12 ? "drag" : "down");
        }
      } else {
        plane.constant = 0;
        raycaster.ray.intersectPlane(plane, point);
        velocity.update(point, now());
        world.pointerVelocity.copy(velocity.value);
        const hit = pick();
        world.hovering = Boolean(hit) || world.mode === "FIELD";
        world.pointer.copy(hit?.point ?? point);
        world.pulse.proximityTarget = hit ? 1 : 0;
        if (hit) world.pulse.hoverPoint.copy(hit.normal);
        cursor(world.hovering ? "hover" : "idle");
      }
    }
    function cancel() {
      const pointer = active;
      active = null; keyboardHeld = false;
      releaseMatter(world, new Vector3(), true);
      if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
      world.hovering = false; world.pointerInside = false; cursor("idle");
    }
    function up(event: PointerEvent) {
      if (event.pointerId !== active) return;
      const pointer = active; active = null;
      releaseMatter(world, velocity.release(now()), event.type === "pointercancel");
      if (process.env.NODE_ENV === "development" && new URLSearchParams(location.search).has("inspect")) {
        console.info("[LUMA input]", JSON.stringify({ input: event.pointerType, mode: world.mode, distance: +moved.toFixed(2), bodies: world.bodies.length, x: event.clientX, y: event.clientY }));
      }
      if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
      if (moved < 0.1 && event.type !== "pointercancel") {
        const time = now();
        if (time - previousTap < 340 && Math.hypot(event.clientX - tapX, event.clientY - tapY) < 30) {
          splitMatter(world); previousTap = -1000;
        } else { previousTap = time; tapX = event.clientX; tapY = event.clientY; }
      }
      cursor(world.hovering ? "hover" : "idle");
    }
    function lost() { if (active !== null) cancel(); }
    function leave() { if (active === null) { world.hovering = false; world.pointerInside = false; world.pulse.proximityTarget = 0; cursor("idle"); } }
    function hidden() { if (document.hidden) cancel(); }
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { cancel(); return; }
      if (document.activeElement !== host) return;
      if ((event.key === " " || event.key === "Enter") && !event.repeat) {
        event.preventDefault(); wakeAudio(); keyboardHeld = true;
        const body = world.bodies.reduce((a, b) => a.volume > b.volume ? a : b);
        point.copy(body.position).add(new Vector3(0, 0, body.radius));
        grabMatter(world, body.id, point, new Vector3(0, 0, 1));
        velocity.reset(point, now()); world.pointer.copy(point); cursor("down");
      } else if (keyboardHeld && event.key.startsWith("Arrow")) {
        event.preventDefault();
        point.x += event.key === "ArrowLeft" ? -0.22 : event.key === "ArrowRight" ? 0.22 : 0;
        point.y += event.key === "ArrowDown" ? -0.22 : event.key === "ArrowUp" ? 0.22 : 0;
        velocity.update(point, now()); moveGrab(world, point, velocity.value); cursor("drag");
      } else if (event.key.toLowerCase() === "d") splitMatter(world);
    }
    function keyup(event: KeyboardEvent) {
      if (keyboardHeld && (event.key === " " || event.key === "Enter")) {
        keyboardHeld = false; releaseMatter(world, velocity.release(now())); cursor("idle");
      }
    }
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", leave); canvas.addEventListener("lostpointercapture", lost);
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    window.addEventListener("blur", cancel); window.addEventListener("resize", cancel);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup);
    return () => {
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave); canvas.removeEventListener("lostpointercapture", lost);
      window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", cancel); window.removeEventListener("resize", cancel);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup);
      cancel();
    };
  }, [camera, gl, surface, wakeAudio, world]);
}
