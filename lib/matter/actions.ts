import { Vector3 } from "three";
import { MAX_BODIES, addRipple, createDroplet, discover, resetMatter, type MatterMode, type MatterWorld } from "./types.ts";

export function grabMatter(world: MatterWorld, id: number, point: Vector3, normal: Vector3) {
  const body = world.bodies.find(body => body.id === id);
  if (!body) return false;
  world.introRate = 5;
  // An early touch takes control immediately and accelerates the remaining formation.
  world.lastInput = world.time;
  world.down = true;
  world.chargeNotified = false;
  world.grip = {
    sourceId: id, bodyId: id, origin: point.clone(), target: point.clone(), normal: normal.clone(),
    detached: body.radius < 0.6 || world.bodies.length >= MAX_BODIES, pulling: false, start: world.time, distance: 0,
  };
  world.fusions = world.fusions.filter(fusion => fusion.a !== id && fusion.b !== id);
  if (world.split && (world.split.a === id || world.split.b === id)) world.split = null;
  body.returnTo = null;
  body.mergeAfter = world.time + 0.7;
  addRipple(world, point, world.mode === "PULSE" ? 1.5 : 1);
  world.pulse.anchor.copy(point);
  world.pulse.hoverPoint.copy(normal);
  world.pulse.pressed = true;
  world.pulse.press.velocity += 1.1;
  world.onSound("touch");
  world.energy += 0.12;
  return true;
}

export function moveGrab(world: MatterWorld, point: Vector3, velocity: Vector3) {
  world.pointer.copy(point);
  world.pointerVelocity.copy(velocity);
  world.lastInput = world.time;
  const grip = world.grip;
  if (!grip) return;
  grip.target.copy(point);
  grip.distance = point.distanceTo(grip.origin);
  if (grip.distance > 0.12) discover(world, "drag");
  if (world.mode === "PULSE") {
    world.pulse.dragTarget.copy(point).sub(grip.origin).clampLength(0, 1.5);
    return;
  }
  if (world.mode === "FIELD") return;
  const parent = world.bodies.find(body => body.id === grip.sourceId);
  if (!parent) return;
  if (!grip.pulling && !grip.detached && grip.distance > 0.16 && world.bodies.length < MAX_BODIES) {
    const volume = Math.min(parent.volume * 0.16, 0.085);
    parent.volume -= volume;
    parent.radius = Math.cbrt(parent.volume);
    const drop = createDroplet(world, grip.origin.clone().addScaledVector(grip.normal, -0.20), volume);
    drop.mergeAfter = world.time + 2;
    world.bodies.push(drop);
    grip.bodyId = drop.id;
    grip.pulling = true;
  }
}

export function releaseMatter(world: MatterWorld, velocity: Vector3, cancelled = false) {
  if (!cancelled) detachGrabIfStretched(world);
  const grip = world.grip;
  world.down = false;
  world.pulse.pressed = false;
  world.pulse.dragTarget.set(0, 0, 0);
  if (grip) {
    const body = world.bodies.find(body => body.id === grip.bodyId);
    if (body) {
      if (grip.pulling && !grip.detached) body.returnTo = grip.sourceId;
      else if (grip.detached || grip.pulling) {
        body.velocity.copy(cancelled ? new Vector3() : velocity).multiplyScalar(0.85).clampLength(0, 7.5);
        body.mergeAfter = world.time + 0.75;
        if (!cancelled && velocity.length() > 1.6) { discover(world, "throw"); world.energy += 0.4; }
      }
    }
    if (!cancelled && grip.distance < 0.12) {
      world.pulse.press.velocity += 1.3;
      addRipple(world, grip.origin, world.mode === "PULSE" ? 1.5 : 0.85);
    }
    if (!cancelled) world.pulse.dragVelocity.addScaledVector(velocity, 0.25).clampLength(0, 6);
    world.pulse.releaseTime = world.pulse.time;
    world.pulse.releaseStrength = 0.7;
  }
  if (world.charge > 0.38 && !cancelled) triggerBloom(world, false);
  world.grip = null;
  world.charge = 0;
}

/** Fast gestures can finish before the spring reaches the pointer. Include the
 * intended stretch so an energetic release is not silently treated as a tap. */
export function detachGrabIfStretched(world: MatterWorld) {
  const grip = world.grip;
  if (!grip?.pulling || grip.detached) return;
  const parent = world.bodies.find(b => b.id === grip.sourceId), child = world.bodies.find(b => b.id === grip.bodyId);
  if (!parent || !child) return;
  const speed = world.pointerVelocity.length();
  const distance = Math.max(parent.position.distanceTo(child.position), parent.position.distanceTo(grip.target) * (speed > 1.5 ? .96 : .86));
  const limit = parent.radius + child.radius + Math.max(.42, .68 - speed * .035);
  if (distance <= limit) return;
  grip.detached = true;
  parent.velocity.addScaledVector(parent.position.clone().sub(child.position).normalize(), .08);
  child.mergeAfter = world.time + 1.2;
  discover(world, "detach"); world.energy += 1;
  world.onSound("detach"); addRipple(world, child.position, .7);
}

export function triggerBloom(world: MatterWorld, secret: boolean) {
  world.bloomStart = world.time;
  if (secret) {
    world.secretStart = world.time;
    world.secretCooldown = world.time + 30;
    world.energy = 0;
    world.seedTarget += 1.73;
  }
  for (const body of world.bodies) {
    const direction = body.position.clone();
    if (direction.length() < 0.1) direction.set(Math.sin(body.id * 2.4), Math.cos(body.id * 1.7), 0);
    body.velocity.addScaledVector(direction.normalize(), secret ? 1.3 : 0.8);
    body.mergeAfter = world.time + 1;
  }
  world.onSound("bloom", secret ? 1 : 0.7);
}

export function splitMatter(world: MatterWorld) {
  if (world.bodies.length >= MAX_BODIES || world.split || world.mode !== "MELT") return;
  const source = world.bodies.reduce((a, b) => a.volume > b.volume ? a : b);
  if (source.volume < 0.2) return;
  releaseMatter(world, new Vector3(), true);
  const child = createDroplet(world, source.position, 0.000001);
  source.volume -= child.volume;
  world.bodies.push(child);
  world.split = { a: source.id, b: child.id, volume: source.volume + child.volume, center: source.position.clone(), start: world.time };
  source.mergeAfter = child.mergeAfter = world.time + 4.8;
  world.lastInput = world.time;
  discover(world, "doubleClick");
  world.onSound("split");
  world.energy += 0.8;
}

export function changeMatterMode(world: MatterWorld, mode: MatterMode) {
  if (world.mode === mode) return;
  releaseMatter(world, new Vector3(), true);
  if (world.mode === "FIELD" && mode === "MELT") resetMatter(world);
  world.mode = mode;
  for (const body of world.bodies) body.mergeAfter = world.time;
  world.lastInput = world.time;
  discover(world, "modeSwitch");
}
