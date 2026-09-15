import { Ray, Vector3, Vector4 } from "three";
import { MAX_METABALLS, type MatterWorld } from "./types.ts";

export interface SurfaceBuffers { balls: Vector4[]; motion: Vector4[]; count: number; min: Vector3; max: Vector3 }
export function createSurfaceBuffers(): SurfaceBuffers {
  return { balls: Array.from({ length: MAX_METABALLS }, () => new Vector4()), motion: Array.from({ length: MAX_METABALLS }, () => new Vector4()), count: 0, min: new Vector3(), max: new Vector3() };
}
const direction = new Vector3();

export function packSurface(world: MatterWorld, surface: SurfaceBuffers) {
  surface.count = 0;
  const arrival = Math.min(1, world.intro / 1.1);
  const formation = .16 + .84 * arrival * arrival * (3 - 2 * arrival);
  surface.min.set(100, 100, 100); surface.max.set(-100, -100, -100);
  const add = (position: Vector3, radius: number, velocity: Vector3) => {
    if (radius < 0.003 || surface.count >= MAX_METABALLS) return;
    const i = surface.count++;
    const speed = velocity.length(), stretch = Math.min(0.42, speed * 0.07);
    surface.balls[i].set(position.x, position.y, position.z, radius * formation * (1 + world.bloom * 0.12));
    surface.motion[i].set(speed > 0.001 ? velocity.x / speed : 1, speed > 0.001 ? velocity.y / speed : 0, speed > 0.001 ? velocity.z / speed : 0, stretch);
    const bound = radius * (1.12 + stretch + world.bloom * 0.12) + 0.36;
    for (const axis of ["x", "y", "z"] as const) {
      surface.min[axis] = Math.min(surface.min[axis], position[axis] - bound);
      surface.max[axis] = Math.max(surface.max[axis], position[axis] + bound);
    }
  };
  for (const body of world.bodies) add(body.position, body.radius, body.velocity);
  const pulseBound = world.pulse.drag.length() * world.pulseMix;
  surface.min.addScalar(-pulseBound); surface.max.addScalar(pulseBound);
  const grip = world.grip;
  if (grip?.pulling && !grip.detached) {
    const parent = world.bodies.find(body => body.id === grip.sourceId), child = world.bodies.find(body => body.id === grip.bodyId);
    if (parent && child) {
      const distance = parent.position.distanceTo(child.position);
      const gap = Math.max(0, distance - parent.radius - child.radius);
      const radius = Math.max(0.04, child.radius * 0.65 * (1 - gap / 0.82));
      for (let i = 1; i <= 3; i++) {
        direction.copy(parent.position).lerp(child.position, 0.25 + i * 0.16);
        add(direction, radius, child.velocity);
      }
    }
  }
}

function smoothMin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export function sampleSurface(p: Vector3, world: MatterWorld, surface: SurfaceBuffers) {
  const t = world.time * (world.reducedMotion ? 0.018 : 0.13);
  const amp = 0.10 + world.pulseMix * 0.015;
  let wx = p.x + Math.sin(p.y * 2.1 + t * 0.71) * Math.sin(p.z * 1.8 - t * 0.31) * amp;
  let wy = p.y + Math.sin(p.z * 2.4 - t * 0.52) * Math.sin(p.x * 2.1 + t * 0.47) * amp;
  let wz = p.z + Math.sin(p.x * 2.0 + t * 0.37) * Math.sin(p.y * 1.7 - t * 0.62) * amp;
  wx = (wx + Math.sin(p.y * 2.4 + .4 + t * .21) * .14) / 1.12;
  wy *= 1.04;
  direction.copy(p).sub(world.pulse.anchor).addScaledVector(world.pulse.drag, -0.45);
  const grab = Math.exp(-direction.lengthSq() * 2.4), pulse = world.pulse;
  wx -= world.pulseMix * (pulse.drag.x * grab * 0.9 + pulse.lag.x * (1 - grab) * 0.105);
  wy -= world.pulseMix * (pulse.drag.y * grab * 0.9 + pulse.lag.y * (1 - grab) * 0.105);
  wz -= world.pulseMix * (pulse.drag.z * grab * 0.9 + pulse.lag.z * (1 - grab) * 0.105);
  let d = 100;
  for (let i = 0; i < surface.count; i++) {
    const ball = surface.balls[i], motion = surface.motion[i];
    let x = wx - ball.x, y = wy - ball.y, z = wz - ball.z;
    const parallel = x * motion.x + y * motion.y + z * motion.z;
    const stretch = 1 + motion.w, squash = Math.sqrt(stretch);
    x = (x - motion.x * parallel) * squash + motion.x * parallel / stretch;
    y = (y - motion.y * parallel) * squash + motion.y * parallel / stretch;
    z = (z - motion.z * parallel) * squash + motion.z * parallel / stretch;
    const radius = ball.w * (1 + Math.sin(t * 1.3 + i * 2.1) * 0.013);
    d = smoothMin(d, Math.hypot(x, y, z) - radius, 0.32 - world.pulseMix * 0.07);
  }
  return d;
}

export function pickSurface(ray: Ray, world: MatterWorld, surface: SurfaceBuffers) {
  const p = new Vector3();
  let distance = 0;
  for (let i = 0; i < 96; i++) {
    ray.at(distance, p);
    const d = sampleSurface(p, world, surface);
    if (d < 0.014) {
      let nearest = world.bodies[0], score = Infinity;
      for (const body of world.bodies) {
        const candidate = p.distanceTo(body.position) - body.radius;
        if (candidate < score) { score = candidate; nearest = body; }
      }
      return { id: nearest.id, point: p.clone(), normal: p.clone().sub(nearest.position).normalize() };
    }
    distance += Math.max(d * 0.7, 0.009);
    if (distance > 18) return null;
  }
  return null;
}
