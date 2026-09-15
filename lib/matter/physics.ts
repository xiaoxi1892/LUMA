import { Vector3 } from "three";
import { stepBlob } from "../blobPhysics.ts";
import { detachGrabIfStretched, triggerBloom } from "./actions.ts";
import { addRipple, discover, type Droplet, type MatterWorld } from "./types.ts";

const direction = new Vector3();
const acceleration = new Vector3();
const target = new Vector3();
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

function integrateBody(world: MatterWorld, body: Droplet, dt: number) {
  const grip = world.grip;
  const active = grip?.bodyId === body.id && world.mode === "MELT";
  acceleration.set(0, 0, 0);
  if (active && (grip.pulling || grip.detached)) {
    target.copy(grip.target).addScaledVector(grip.normal, -body.radius * 0.3);
    acceleration.copy(target).sub(body.position).multiplyScalar(145);
    body.velocity.multiplyScalar(Math.exp(-19 * dt));
  } else if (body.returnTo !== null) {
    const parent = world.bodies.find(other => other.id === body.returnTo);
    if (parent) acceleration.copy(parent.position).sub(body.position).multiplyScalar(38);
    body.velocity.multiplyScalar(Math.exp(-7 * dt));
  } else {
    const quiet = world.time - world.lastInput;
    const secretAge = world.time - world.secretStart;
    const gathering = world.mode !== "MELT" || (secretAge > 0.75 && secretAge < 3.2);
    const field = gathering ? 3.5 : quiet > 3.5 ? 0.32 : 0.08;
    acceleration.copy(body.position).multiplyScalar(-field);
    acceleration.z -= body.position.z * 1.8;
    acceleration.x += Math.sin(world.time * 0.23 + body.id * 2.1) * 0.015;
    acceleration.y += Math.cos(world.time * 0.19 + body.id * 1.7) * 0.012;
    body.velocity.multiplyScalar(Math.exp(-(gathering ? 2.6 : 0.65) * dt));
    if (world.charge > 0.3 && grip && grip.sourceId !== body.id) {
      const main = world.bodies.find(other => other.id === grip.sourceId);
      if (main) acceleration.addScaledVector(direction.copy(main.position).sub(body.position), world.charge * 4);
    }
    if (grip?.sourceId === body.id && grip.pulling && !grip.detached) {
      const tip = world.bodies.find(other => other.id === grip.bodyId);
      if (tip) acceleration.addScaledVector(direction.copy(tip.position).sub(body.position), .65);
    }
  }
  // The edge is a soft containment field, not a visible wall or downward gravity.
  const xLimit = Math.max(0.12, world.bounds.x - body.radius - 0.15);
  const yLimit = Math.max(0.12, world.bounds.y - body.radius - 0.32);
  for (const [axis, limit] of [["x", xLimit], ["y", yLimit]] as const) {
    const edge = Math.max(0, Math.min(1, (Math.abs(body.position[axis]) - limit + .28) / .28));
    if (body.position[axis] * body.velocity[axis] > 0) body.velocity[axis] *= Math.exp(-edge * 24 * dt);
  }
  if (Math.abs(body.position.x) > xLimit) acceleration.x -= Math.sign(body.position.x) * (Math.abs(body.position.x) - xLimit) * 35;
  if (Math.abs(body.position.y) > yLimit) acceleration.y -= Math.sign(body.position.y) * (Math.abs(body.position.y) - yLimit) * 35;
  body.velocity.addScaledVector(acceleration, dt).clampLength(0, 9);
  body.position.addScaledVector(body.velocity, dt);
}

function connectBodies(world: MatterWorld, dt: number) {
  for (let i = 0; i < world.bodies.length; i++) {
    for (let j = i + 1; j < world.bodies.length; j++) {
      const a = world.bodies[i], b = world.bodies[j];
      if (world.time < Math.max(a.mergeAfter, b.mergeAfter)) continue;
      if (world.fusions.some(f => f.a === a.id || f.b === a.id || f.a === b.id || f.b === b.id)) continue;
      if (world.grip && (world.grip.bodyId === a.id || world.grip.bodyId === b.id)) continue;
      const distance = direction.copy(b.position).sub(a.position).length();
      const sum = a.radius + b.radius;
      if (distance < sum + 0.65) {
        const force = Math.max(0, 1 - (distance - sum) / 0.65) * 2.8;
        direction.multiplyScalar(1 / Math.max(distance, 0.001));
        a.velocity.addScaledVector(direction, force * dt * b.volume / (a.volume + b.volume));
        b.velocity.addScaledVector(direction, -force * dt * a.volume / (a.volume + b.volume));
      }
      if (distance < Math.max(a.radius, b.radius) + Math.min(a.radius, b.radius) * 0.42) {
        const large = a.volume >= b.volume ? a : b, small = large === a ? b : a;
        // Blend momentum by volume before transferring any mass.
        large.velocity.multiplyScalar(large.volume).addScaledVector(small.velocity, small.volume).divideScalar(large.volume + small.volume);
        world.fusions.push({ a: large.id, b: small.id, volumeA: large.volume, volumeB: small.volume, start: world.time });
        addRipple(world, large.position.clone().lerp(small.position, 0.5), 0.8);
        world.onSound("merge", Math.min(1, small.radius));
        if (world.time > 2.4) { discover(world, "merge"); world.energy += 0.75; }
      }
    }
  }
}

function morphBodies(world: MatterWorld, dt: number) {
  for (let i = world.fusions.length - 1; i >= 0; i--) {
    const fusion = world.fusions[i];
    const a = world.bodies.find(body => body.id === fusion.a), b = world.bodies.find(body => body.id === fusion.b);
    if (!a || !b) { world.fusions.splice(i, 1); continue; }
    const t = smooth((world.time - fusion.start) / 0.48);
    a.volume = fusion.volumeA + fusion.volumeB * t;
    b.volume = fusion.volumeB * (1 - t);
    a.radius = Math.cbrt(a.volume); b.radius = Math.cbrt(b.volume);
    b.position.lerp(a.position, 1 - Math.exp(-8 * dt));
    if (t === 1) {
      world.bodies = world.bodies.filter(body => body.id !== b.id);
      world.fusions.splice(i, 1);
    }
  }
  const split = world.split;
  if (split) {
    const a = world.bodies.find(body => body.id === split.a), b = world.bodies.find(body => body.id === split.b);
    if (!a || !b) { world.split = null; return; }
    const t = smooth((world.time - split.start) / 1.15);
    b.volume = split.volume * 0.5 * Math.max(t, 0.000002);
    a.volume = split.volume - b.volume;
    a.radius = Math.cbrt(a.volume); b.radius = Math.cbrt(b.volume);
    const separation = (a.radius + b.radius + 0.45) * t * 0.5;
    a.position.copy(split.center).add(new Vector3(-separation, -0.09 * t, 0));
    b.position.copy(split.center).add(new Vector3(separation, 0.09 * t, 0));
    if (t === 1) {
      a.velocity.set(-0.14, 0.05, 0); b.velocity.set(0.14, -0.05, 0);
      world.split = null;
    }
  }
}

export function stepMatter(world: MatterWorld, delta: number) {
  const duration = Math.min(delta, 0.05);
  world.time += duration;
  world.intro += duration * world.introRate;
  const steps = Math.max(1, Math.ceil(duration * 120)), dt = duration / steps;
  world.pulse.time = world.time;
  stepBlob(world.pulse, duration);
  const transition = 1 - Math.exp(-3.6 * duration);
  world.pulseMix += ((world.mode === "PULSE" ? 1 : 0) - world.pulseMix) * transition;
  world.fieldMix += ((world.mode === "FIELD" ? 1 : 0) - world.fieldMix) * transition;
  world.seed += (world.seedTarget - world.seed) * (1 - Math.exp(-1.6 * duration));
  if (world.down && world.grip && world.grip.distance < 0.18) {
    world.charge = Math.min(1, (world.time - world.grip.start) / 2.5);
    if (world.charge > 0.4 && !world.chargeNotified) { discover(world, "hold"); world.chargeNotified = true; world.energy += 0.35; }
  } else world.charge *= Math.exp(-8 * duration);
  const bloomAge = world.time - world.bloomStart;
  world.bloom = bloomAge < 1.2 ? Math.sin(Math.min(1, bloomAge / 0.22) * Math.PI / 2) * Math.exp(-Math.max(0, bloomAge - 0.15) * 4) : 0;
  const secretAge = world.time - world.secretStart;
  if (secretAge >= 0 && secretAge < 0.10) return;
  for (let i = 0; i < steps; i++) {
    if (world.intro < 1.6 && !world.grip) {
      for (const body of world.bodies) {
        body.velocity.addScaledVector(body.position, -dt * (4 + world.intro * 4));
        body.velocity.multiplyScalar(Math.exp(-4 * dt));
        body.position.addScaledVector(body.velocity, dt);
        body.mergeAfter = world.time;
      }
    } else for (const body of world.bodies) integrateBody(world, body, dt);
    connectBodies(world, dt);
    morphBodies(world, dt);
    detachGrabIfStretched(world);
  }
  world.ripples = world.ripples.filter(r => world.time - r.born < 2.2);
  world.energy = Math.max(0, world.energy - duration * 0.012);
  if (world.energy > 5.2 && !world.down && world.time > world.secretCooldown) triggerBloom(world, true);
  if (world.time - world.lastInput > 20) {
    addRipple(world, world.bodies[0].position.clone().add(new Vector3(0.4, 0.5, 0.7)), 0.14);
    world.lastInput = world.time;
  }
}

export function totalVolume(world: MatterWorld) { return world.bodies.reduce((sum, body) => sum + body.volume, 0); }
