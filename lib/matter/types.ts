import { Vector2, Vector3 } from "three";
import { createBlobState, type BlobState } from "../blobPhysics.ts";

export const MAX_BODIES = 9;
export const MAX_METABALLS = 12;
export type MatterMode = "MELT" | "PULSE" | "FIELD";
export type Discovery = "drag" | "detach" | "merge" | "throw" | "hold" | "doubleClick" | "modeSwitch";
export type SoundEvent = "touch" | "detach" | "merge" | "bloom" | "split";
export interface Droplet {
  id: number;
  position: Vector3;
  velocity: Vector3;
  volume: number;
  radius: number;
  born: number;
  mergeAfter: number;
  returnTo: number | null;
}
export interface Ripple { point: Vector3; born: number; strength: number }
export interface Grip {
  sourceId: number;
  bodyId: number;
  origin: Vector3;
  target: Vector3;
  normal: Vector3;
  detached: boolean;
  pulling: boolean;
  start: number;
  distance: number;
}
export interface Fusion { a: number; b: number; volumeA: number; volumeB: number; start: number }
export interface Split { a: number; b: number; volume: number; center: Vector3; start: number }
export interface MatterWorld {
  time: number;
  bodies: Droplet[];
  nextId: number;
  grip: Grip | null;
  fusions: Fusion[];
  split: Split | null;
  ripples: Ripple[];
  pointer: Vector3;
  pointerVelocity: Vector3;
  pointerNdc: Vector2;
  pointerInside: boolean;
  down: boolean;
  hovering: boolean;
  charge: number;
  chargeNotified: boolean;
  bloom: number;
  bloomStart: number;
  secretStart: number;
  secretCooldown: number;
  energy: number;
  seed: number;
  seedTarget: number;
  mode: MatterMode;
  pulseMix: number;
  fieldMix: number;
  pulse: BlobState;
  intro: number;
  introRate: number;
  reducedMotion: boolean;
  lastInput: number;
  bounds: Vector2;
  onDiscover: (event: Discovery) => void;
  onSound: (event: SoundEvent, intensity?: number) => void;
}

export function createDroplet(world: MatterWorld, position: Vector3, volume: number): Droplet {
  return { id: world.nextId++, position: position.clone(), velocity: new Vector3(), volume,
    radius: Math.cbrt(Math.max(0, volume)), born: world.time, mergeAfter: world.time + 0.6, returnTo: null };
}

export function createMatterWorld(): MatterWorld {
  const world: MatterWorld = {
    time: 0, bodies: [], nextId: 0, grip: null, fusions: [], split: null, ripples: [],
    pointer: new Vector3(20, 20, 0), pointerVelocity: new Vector3(), pointerNdc: new Vector2(),
    pointerInside: false, down: false, hovering: false, charge: 0, chargeNotified: false,
    bloom: 0, bloomStart: -10, secretStart: -10, secretCooldown: 12, energy: 0,
    seed: 1.7, seedTarget: 1.7, mode: "MELT", pulseMix: 0, fieldMix: 0,
    pulse: createBlobState(), intro: 0, introRate: 1, reducedMotion: false, lastInput: 0,
    bounds: new Vector2(3.2, 2.1), onDiscover: () => {}, onSound: () => {},
  };
  resetMatter(world);
  return world;
}

export function resetMatter(world: MatterWorld) {
  world.bodies = [
    createDroplet(world, new Vector3(-1.25, -0.15, 0), 0.67),
    createDroplet(world, new Vector3(1.15, 0.35, 0.12), 0.36),
    createDroplet(world, new Vector3(0.15, 1.15, -0.06), 0.17),
  ];
  world.grip = null; world.fusions = []; world.split = null; world.ripples = [];
  world.down = false; world.charge = 0; world.energy = 0; world.intro = 0;
  world.bloomStart = -10; world.secretStart = -10; world.bloom = 0;
  world.pulse = createBlobState(); world.introRate = 1;
  if (world.reducedMotion) finishFormation(world);
}

export function finishFormation(world: MatterWorld) {
  world.intro = 2;
  const total = world.bodies.reduce((sum, body) => sum + body.volume, 0);
  world.bodies = [createDroplet(world, new Vector3(), total)];
}

export function discover(world: MatterWorld, event: Discovery) { world.onDiscover(event); }
export function addRipple(world: MatterWorld, point: Vector3, strength = 1) {
  world.ripples.push({ point: point.clone(), born: world.time, strength });
  if (world.ripples.length > 5) world.ripples.shift();
}
