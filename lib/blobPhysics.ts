import { Vector3 } from "three";

export type Spring = { value: number; velocity: number };

export interface BlobState {
  time: number;
  anchor: Vector3;
  hoverPoint: Vector3;
  drag: Vector3;
  dragVelocity: Vector3;
  dragTarget: Vector3;
  lag: Vector3;
  center: Vector3;
  centerVelocity: Vector3;
  press: Spring;
  proximity: number;
  proximityTarget: number;
  pressed: boolean;
  releaseTime: number;
  releaseStrength: number;
  reducedMotion: boolean;
}

export function createBlobState(): BlobState {
  return {
    time: 0,
    anchor: new Vector3(0, 0, 1),
    hoverPoint: new Vector3(0, 0, 1),
    drag: new Vector3(), dragVelocity: new Vector3(), dragTarget: new Vector3(),
    lag: new Vector3(), center: new Vector3(), centerVelocity: new Vector3(),
    press: { value: 0, velocity: 0 },
    proximity: 0, proximityTarget: 0, pressed: false,
    releaseTime: -10, releaseStrength: 0, reducedMotion: false,
  };
}

export function springScalar(s: Spring, target: number, dt: number, stiffness: number, damping: number) {
  s.velocity += ((target - s.value) * stiffness - s.velocity * damping) * dt;
  s.value += s.velocity * dt;
}

const bodyTarget = new Vector3();

export function stepBlob(state: BlobState, delta: number) {
  // Small substeps keep the spring stable after slow frames or a background tab.
  const duration = Math.min(delta, 0.05);
  const steps = Math.max(1, Math.ceil(duration / (1 / 120)));
  const dt = duration / steps;
  for (let i = 0; i < steps; i++) {
    springScalar(state.press, state.pressed ? 0.23 : 0, dt, 155, 13);
    for (const axis of ["x", "y", "z"] as const) {
      state.dragVelocity[axis] += ((state.dragTarget[axis] - state.drag[axis]) * 115 - state.dragVelocity[axis] * 12.5) * dt;
      state.drag[axis] += state.dragVelocity[axis] * dt;
    }
    bodyTarget.copy(state.drag).multiplyScalar(0.12);
    for (const axis of ["x", "y", "z"] as const) {
      state.centerVelocity[axis] += ((bodyTarget[axis] - state.center[axis]) * 38 - state.centerVelocity[axis] * 7.2) * dt;
      state.center[axis] += state.centerVelocity[axis] * dt;
    }
    state.lag.lerp(state.drag, 1 - Math.exp(-6 * dt));
    state.proximity += (state.proximityTarget - state.proximity) * (1 - Math.exp(-8 * dt));
  }
}

/** CPU twin of blob.vert.ts. Used only for the small, invisible picking mesh.
 * This makes a stretched tip clickable, instead of raycasting an undeformed sphere.
 */
export function deformPoint(p: Vector3, state: BlobState, out: Vector3) {
  const t = state.time * (state.reducedMotion ? 0.015 : 0.085);
  const a = Math.sin(p.x * 2.7 + p.y * 1.5 + t * 0.71);
  const b = Math.sin(p.y * 3.1 - p.z * 1.6 - t * 0.57);
  const c = Math.sin(p.z * 3.4 + p.x * 1.8 + t * 0.43);
  const n = a * b * c;
  const n2 = Math.sin(p.x * 5.2 - t * 0.6) * Math.sin(p.y * 4.1 + p.z * 2.2 + t * 0.8);
  const radius = 1 + n * 0.135 + n2 * 0.027 + Math.sin(t * 1.4) * 0.018;
  out.set(p.x * 1.075, p.y * 1.035, p.z * 0.94).multiplyScalar(radius);
  out.x += 0.075 * p.y * p.y - 0.03;
  out.y += 0.035 * Math.sin(t * 0.8);
  const distance = p.distanceTo(state.anchor);
  const grab = Math.exp(-distance * distance * 3.4);
  const hover = Math.exp(-p.distanceToSquared(state.hoverPoint) * 3.8);
  out.addScaledVector(p, hover * state.proximity * 0.047);
  out.addScaledVector(p, -state.press.value * grab);
  out.addScaledVector(p, state.press.value * 0.075 * (1 - grab));
  out.addScaledVector(state.drag, grab * 0.93);
  out.addScaledVector(state.lag, (1 - grab) * 0.105);
  // The broad, delayed shear gives the untouched side weight.
  const shear = (state.drag.x - state.lag.x) * p.y - (state.drag.y - state.lag.y) * p.x;
  out.x += -p.y * shear * 0.11;
  out.y += p.x * shear * 0.11;
  const age = state.time - state.releaseTime;
  const ripple = Math.sin(distance * 10 - age * 13) * Math.exp(-age * 4.4) * Math.exp(-distance * 0.7) * state.releaseStrength * 0.032;
  if (age >= 0 && age < 2) out.addScaledVector(p, ripple);
  out.add(state.center);
  return out;
}
