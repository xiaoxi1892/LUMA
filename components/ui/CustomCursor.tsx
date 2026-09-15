"use client";
import { useEffect, useRef } from "react";
export default function CustomCursor() {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!matchMedia("(pointer: fine)").matches) return;
    const cursor = element.current;
    if (!cursor) return;
    const surface = document.querySelector<HTMLElement>(".matter-surface");
    let x = -100, y = -100, previousX = x, previousY = y, frame = 0;
    let pressed = false, visible = false;
    const move = (event: PointerEvent) => { x = event.clientX; y = event.clientY; visible = true; };
    const down = () => { pressed = true; };
    const up = () => { pressed = false; };
    const leave = () => { visible = false; pressed = false; };
    const tick = () => {
      const dx = x - previousX, dy = y - previousY;
      const speed = Math.min(16, Math.hypot(dx, dy));
      previousX = x; previousY = y;
      const state = surface?.dataset.pointer;
      const hover = state === "hover" || state === "drag" || state === "down";
      const size = pressed ? 13 : hover ? 21 : 5;
      cursor.style.width = `${size}px`; cursor.style.height = `${size}px`;
      cursor.style.opacity = visible ? "1" : "0";
      cursor.style.backgroundColor = hover || pressed ? "transparent" : "#e0e8e6";
      cursor.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(${Math.atan2(dy, dx)}rad) scale(${1 + (pressed ? speed * 0.02 : 0)},${1 - (pressed ? speed * 0.008 : 0)})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener("pointermove", move); window.addEventListener("pointerdown", down); window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", leave); document.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", leave); document.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <div className="matter-cursor" ref={element} aria-hidden="true" />;
}
