import { test } from "node:test";
import assert from "node:assert/strict";
import { Ray, Vector3 } from "three";
import { createMatterWorld, createDroplet, finishFormation, MAX_BODIES } from "../lib/matter/types.ts";
import { grabMatter, moveGrab, releaseMatter, splitMatter } from "../lib/matter/actions.ts";
import { stepMatter, totalVolume } from "../lib/matter/physics.ts";
import { createSurfaceBuffers, packSurface, pickSurface } from "../lib/matter/surface.ts";

test("pull detaches an independently pickable droplet without losing volume", () => {
  const world = createMatterWorld(); finishFormation(world);
  const volume = totalVolume(world), main = world.bodies[0];
  const hit = new Vector3(main.radius, 0, 0);
  grabMatter(world, main.id, hit, new Vector3(1, 0, 0));
  for (let i = 0; i < 90; i++) {
    moveGrab(world, new Vector3(main.radius + i * 0.03, 0, 0), new Vector3(1.8, 0, 0));
    stepMatter(world, 1 / 60);
  }
  assert.equal(world.grip?.detached, true);
  assert.equal(world.bodies.length, 2);
  assert.ok(Math.abs(totalVolume(world) - volume) < 1e-8);
  const drop = world.bodies.find(body => body.id === world.grip?.bodyId)!;
  const surface = createSurfaceBuffers(); packSurface(world, surface);
  const ray = new Ray(drop.position.clone().add(new Vector3(0, 0, 5)), new Vector3(0, 0, -1));
  assert.equal(pickSurface(ray, world, surface)?.id, drop.id);
  releaseMatter(world, new Vector3(5, 0, 0));
  assert.ok(drop.velocity.x > 4);
  assert.equal(world.grip, null);
});

test("nearby drops form a neck before merging continuously and conserving volume", () => {
  const world = createMatterWorld(); world.intro = 2;
  world.bodies = [createDroplet(world, new Vector3(-0.8, 0, 0), 0.5), createDroplet(world, new Vector3(0.8, 0, 0), 0.5)];
  const volume = totalVolume(world);
  let transferred = false;
  for (let i = 0; i < 480; i++) {
    stepMatter(world, 1 / 60);
    if (world.fusions.length) transferred = true;
    assert.ok(Math.abs(totalVolume(world) - volume) < 1e-7);
  }
  assert.ok(transferred);
  assert.equal(world.bodies.length, 1);
});

test("double-tap splits by volume transfer and naturally rejoins", () => {
  const world = createMatterWorld(); finishFormation(world);
  const volume = totalVolume(world);
  splitMatter(world);
  assert.ok(world.bodies[1].radius < 0.02, "child starts inside the parent, not as a full-size copy");
  for (let i = 0; i < 80; i++) stepMatter(world, 1 / 60);
  assert.equal(world.bodies.length, 2);
  assert.ok(world.bodies[0].position.distanceTo(world.bodies[1].position) > 1.6);
  assert.ok(Math.abs(totalVolume(world) - volume) < 1e-7);
  for (let i = 0; i < 600; i++) stepMatter(world, 1 / 60);
  assert.equal(world.bodies.length, 1);
});

test("render primitives stay bounded under repeated interactions and long frames", () => {
  const world = createMatterWorld(); finishFormation(world);
  const surface = createSurfaceBuffers();
  for (let i = 0; i < 1000; i++) {
    if (i % 150 === 0) splitMatter(world);
    stepMatter(world, i % 80 === 0 ? 4 : 1 / 60);
    packSurface(world, surface);
    assert.ok(world.bodies.length <= MAX_BODIES);
    assert.ok(surface.count <= 12);
    assert.ok(world.bodies.every(body => Number.isFinite(body.position.x) && body.volume >= 0));
  }
});

test("a fast flick detaches even before the damped body catches the pointer", () => {
  const world = createMatterWorld(); finishFormation(world);
  const main = world.bodies[0];
  grabMatter(world, main.id, new Vector3(.6, 0, .88), new Vector3(.56, 0, .83));
  moveGrab(world, new Vector3(2.7, .2, .88), new Vector3(8, 1, 0));
  stepMatter(world, 1 / 120);
  releaseMatter(world, new Vector3(8, 1, 0));
  const drop = world.bodies[1];
  assert.equal(drop.returnTo, null);
  assert.ok(drop.velocity.x > 6);
  for (let i = 0; i < 30; i++) stepMatter(world, 1 / 60);
  assert.equal(world.bodies.length, 2);
  assert.ok(drop.position.distanceTo(main.position) > main.radius + drop.radius);
});

test("formation completes in 1.8 seconds and hold releases a soft bloom", () => {
  const world = createMatterWorld();
  for (let i = 0; i < 108; i++) stepMatter(world, 1 / 60);
  assert.equal(world.bodies.length, 1);
  const body = world.bodies[0];
  grabMatter(world, body.id, body.position.clone().add(new Vector3(0, 0, body.radius)), new Vector3(0, 0, 1));
  for (let i = 0; i < 160; i++) stepMatter(world, 1 / 60);
  assert.equal(world.charge, 1);
  releaseMatter(world, new Vector3());
  stepMatter(world, .05);
  assert.ok(world.bloom > .25);
  for (let i = 0; i < 120; i++) stepMatter(world, 1 / 60);
  assert.equal(world.bloom, 0);
});
