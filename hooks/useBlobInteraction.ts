"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Mesh, MeshBasicMaterial, Plane, Raycaster, SphereGeometry, Triangle, Vector2, Vector3 } from "three";
import { type BlobState, deformPoint } from "@/lib/blobPhysics";
import { PointerVelocity } from "./usePointerVelocity";

export type InteractionPhase = "idle" | "near" | "holding" | "stretching" | "settling";

export function useBlobInteraction(state: BlobState, onPhase: (phase: InteractionPhase) => void) {
  const { gl, camera } = useThree();
  const picker = useMemo(() => {
    const geometry = new SphereGeometry(1, 32, 24);
    const rest = new Float32Array(geometry.attributes.position.array);
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    // Picking vertices change each frame, so disable the static bounds shortcut.
    geometry.boundingSphere = null;
    return { geometry, rest, mesh, point: new Vector3(), deformed: new Vector3() };
  }, []);

  useFrame(() => {
    const positions = picker.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      picker.point.fromArray(picker.rest, i * 3).normalize();
      deformPoint(picker.point, state, picker.deformed);
      positions.setXYZ(i, picker.deformed.x, picker.deformed.y, picker.deformed.z);
    }
    picker.geometry.computeBoundingSphere();
    // CPU raycasting reads positions directly; no GPU upload is needed.
  }, -1);

  useEffect(() => {
    const canvas = gl.domElement;
    const surface = canvas.closest<HTMLElement>(".interaction-surface") ?? canvas;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const plane = new Plane(new Vector3(0, 0, 1), 0);
    const point = new Vector3();
    const origin = new Vector3();
    const rest = new Vector3();
    const bary = new Vector3();
    const triangle = new Triangle();
    const velocity = new PointerVelocity();
    let activePointer: number | null = null;
    let keyboardHeld = false;
    let moved = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    function phase(next: InteractionPhase) {
      clearTimeout(settleTimer);
      onPhase(next);
    }
    function aim(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
    }
    function hit() {
      const intersection = raycaster.intersectObject(picker.mesh, false)[0];
      if (!intersection?.face) return null;
      const { a, b, c } = intersection.face;
      const positions = picker.geometry.attributes.position;
      triangle.a.fromBufferAttribute(positions, a);
      triangle.b.fromBufferAttribute(positions, b);
      triangle.c.fromBufferAttribute(positions, c);
      triangle.getBarycoord(intersection.point, bary);
      rest.set(0, 0, 0);
      rest.addScaledVector(point.fromArray(picker.rest, a * 3), bary.x);
      rest.addScaledVector(point.fromArray(picker.rest, b * 3), bary.y);
      rest.addScaledVector(point.fromArray(picker.rest, c * 3), bary.z).normalize();
      return intersection;
    }
    function down(event: PointerEvent) {
      if (activePointer !== null || !event.isPrimary || event.button !== 0) return;
      aim(event);
      const intersection = hit();
      if (!intersection) return;
      event.preventDefault();
      surface.focus({ preventScroll: true });
      activePointer = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      state.anchor.copy(rest);
      state.hoverPoint.copy(rest);
      state.pressed = true;
      state.proximityTarget = 1;
      state.press.velocity += 0.8;
      state.dragTarget.set(0, 0, 0);
      plane.constant = -intersection.point.z;
      raycaster.ray.intersectPlane(plane, origin);
      velocity.reset(origin, performance.now());
      moved = 0;
      phase("holding");
    }
    function move(event: PointerEvent) {
      aim(event);
      if (activePointer !== null) {
        if (event.pointerId !== activePointer) return;
        if (!raycaster.ray.intersectPlane(plane, point)) return;
        velocity.update(point, performance.now());
        state.dragTarget.copy(point).sub(origin).clampLength(0, 1.8);
        moved = Math.max(moved, state.dragTarget.length());
        if (moved > 0.07) phase("stretching");
        return;
      }
      const intersection = hit();
      if (intersection) {
        state.hoverPoint.copy(rest);
        state.proximityTarget = 1;
        phase("near");
      } else {
        plane.constant = 0;
        raycaster.ray.intersectPlane(plane, point);
        const distance = Math.hypot(point.x - state.center.x, point.y - state.center.y);
        state.proximityTarget = Math.exp(-Math.max(0, distance - 0.95) * 4.5);
        state.hoverPoint.set(point.x - state.center.x, point.y - state.center.y, 0.45).normalize();
        if (state.proximityTarget < 0.2) phase("idle");
      }
    }
    function release(cancelled = false) {
      if (activePointer === null && !keyboardHeld) return;
      const pointer = activePointer;
      activePointer = null;
      keyboardHeld = false;
      if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
      state.pressed = false;
      state.dragTarget.set(0, 0, 0);
      state.proximityTarget = 0;
      if (!cancelled) {
        state.dragVelocity.addScaledVector(velocity.release(performance.now()), 0.33).clampLength(0, 6);
        // A very short tap still produces an indentation, even between frames.
        if (moved < 0.07) state.press.velocity += 1.15;
        state.releaseTime = state.time;
        state.releaseStrength = Math.min(1, 0.3 + moved * 0.5);
      }
      if (process.env.NODE_ENV === "development" && new URLSearchParams(location.search).has("inspect")) {
        console.info("[LUMA release]", JSON.stringify({ cancelled, displacement: moved, indentation: state.press.value, stretch: state.drag.length(), releaseVelocity: state.dragVelocity.length() }));
      }
      phase("settling");
      settleTimer = setTimeout(() => phase("idle"), 1400);
    }
    function up(event: PointerEvent) {
      if (event.pointerId === activePointer) release(event.type === "pointercancel");
    }
    function leave() {
      if (activePointer === null) { state.proximityTarget = 0; phase("idle"); }
    }
    function blur() { release(true); state.proximityTarget = 0; }
    function visibility() { if (document.hidden) blur(); }
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { release(true); return; }
      if (document.activeElement !== surface) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (event.repeat || state.pressed) return;
        keyboardHeld = true;
        moved = 0;
        state.anchor.set(0, 0, 1);
        state.pressed = true;
        state.press.velocity += 0.8;
        phase("holding");
      }
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        if (!keyboardHeld) return;
        state.dragTarget.x += event.key === "ArrowLeft" ? -0.16 : event.key === "ArrowRight" ? 0.16 : 0;
        state.dragTarget.y += event.key === "ArrowDown" ? -0.16 : event.key === "ArrowUp" ? 0.16 : 0;
        state.dragTarget.clampLength(0, 1.8);
        moved = state.dragTarget.length();
        phase("stretching");
      }
    }
    function keyup(event: KeyboardEvent) {
      if (keyboardHeld && (event.key === " " || event.key === "Enter")) release();
    }

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("lostpointercapture", blur);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", blur);
    window.addEventListener("resize", blur);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    return () => {
      clearTimeout(settleTimer);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("lostpointercapture", blur);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", blur);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      state.pressed = false;
      state.dragTarget.set(0, 0, 0);
    };
  }, [camera, gl, onPhase, picker, state]);

  useEffect(() => () => {
    picker.geometry.dispose();
    picker.mesh.material.dispose();
  }, [picker]);
}
