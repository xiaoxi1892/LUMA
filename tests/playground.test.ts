import test from "node:test";
import assert from "node:assert/strict";
import { BubbleField } from "../lib/playground/BubbleField.ts";
import { BeadField } from "../lib/playground/BeadField.ts";
import {
  MaterialTransition,
  modeWeights,
} from "../lib/playground/MaterialTransition.ts";
import { BreakClock } from "../lib/sand/BreakClock.ts";
const step = (f: { step(dt: number): void }, seconds: number) => {
  for (let i = 0; i < seconds * 120; i++) f.step(1 / 120);
};
test("a held cell dents locally, neighbors respond, pressure remains bounded and release settles", () => {
  const f = new BubbleField();
  f.layout(12, 7.8);
  const c = f.cells[Math.floor(f.cells.length / 2)];
  f.begin(c.x, c.y);
  step(f, 2.5);
  assert(c.depth > 0.5 && c.depth <= 0.79);
  assert(f.cells.filter((v) => v.depth > 0.005).length > 1);
  assert(f.cells.filter((v) => v.depth > 0.5).length < 4);
  f.end();
  step(f, 6);
  assert(Math.max(...f.cells.map((c) => Math.abs(c.depth))) < 0.01);
  assert(c.memory > 0);
});
test("one fast swipe interpolates every crossed cell and different caps retain independent timing", () => {
  const f = new BubbleField();
  f.layout(12, 7.8);
  const y = f.cells[40].y;
  f.begin(-5, y);
  f.move(5, y, 16);
  assert(f.presses >= 10);
  const pressure = f.cells.filter((c) => c.depth > 0.02);
  assert(pressure.length >= 10);
  assert(new Set(pressure.map((c) => c.damping)).size > 1);
  f.move(-5, y + 0.8, 16);
  assert(f.waveCount > 0);
  f.end();
});
test("beads build a volumetric cluster without singularities, transfer throws and settle", () => {
  const f = new BeadField(168);
  f.layout(7, 9);
  f.begin(0, 0);
  step(f, 2);
  assert(f.beads.some((b) => b.z > 0.4));
  assert(f.beads.every((b) => Number.isFinite(b.x + b.y + b.z)));
  let overlaps = 0;
  for (let i = 0; i < f.beads.length; i++)
    for (let j = i + 1; j < f.beads.length; j++) {
      const a = f.beads[i],
        b = f.beads[j];
      if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < (a.r + b.r) * 0.86)
        overlaps++;
    }
  assert(overlaps < 5, `severe overlaps: ${overlaps}`);
  f.end(true, 15, 3);
  assert.equal(f.throws, 1);
  assert(f.beads.some((b) => b.vx > 2));
  step(f, 9);
  assert(f.beads.every((b) => Math.abs(b.x) <= 3.5 && Math.abs(b.y) <= 4.5));
  assert(
    f.beads.reduce((n, b) => n + Math.hypot(b.vx, b.vy), 0) / f.beads.length <
      0.08,
  );
});
test("repulsion expires, collision energy is aggregated and can be drained", () => {
  const f = new BeadField(168);
  f.begin(0, 0);
  step(f, 0.8);
  assert(f.collisionCount > 0);
  assert(f.collisionImpulse > 0);
  f.clearAudio();
  assert.equal(f.collisionCount, 0);
  f.end(false);
  f.repel();
  step(f, 2.5);
  assert.equal(f.polarity, 0);
});
test("material geometry weights are continuous at both ends in all six directions; clock is independent", () => {
  const clock = new BreakClock();
  clock.start();
  clock.step(47);
  for (const from of ["sand", "bubble", "beads"] as const)
    for (const to of ["sand", "bubble", "beads"] as const) {
      if (from === to) continue;
      const t = new MaterialTransition();
      t.start(from, to);
      assert.deepEqual(t.weights(), modeWeights(from));
      step(t, 0.7);
      const w = t.weights();
      assert(Math.abs(w.reduce((a, b) => a + b) - 1) < 1e-8);
      assert(w.filter((x) => x > 0).length === 2);
      t.skip();
      assert.deepEqual(t.weights(), modeWeights(to));
      assert.equal(clock.elapsed, 47);
    }
  clock.step(73);
  assert(clock.completed);
});
