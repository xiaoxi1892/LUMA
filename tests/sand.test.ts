import { test } from "node:test";
import assert from "node:assert/strict";
import { SurfaceField } from "../lib/sand/SurfaceField.ts";
import { BreakClock } from "../lib/sand/BreakClock.ts";

function difference(a: Float32Array, b: Float32Array) {
  let result = 0;
  for (let i = 0; i < a.length; i++) result += Math.abs(a[i] - b[i]);
  return result;
}
function flat() {
  const field = new SurfaceField(192);
  field.height.set(field.base);
  return field;
}

test("a fast whole-tray comb stroke is continuous and persists after 10 seconds", () => {
  const f = flat(),
    before = f.height.slice();
  f.begin(-3, 0, "comb");
  f.move(3, 0, 9);
  f.end();
  assert.ok(difference(f.height, before) > 1);
  const after = f.height.slice();
  for (let i = 0; i < 600; i++) f.step(1 / 60);
  assert.deepEqual(f.height, after, "quiet time must not erase the work");
  for (const x of [-2, -1, 0, 1, 2]) {
    const column = Math.round((x / f.width + 0.5) * (f.size - 1));
    let changed = 0;
    for (let j = 84; j < 108; j++)
      changed += Math.abs(
        f.height[j * f.size + column] - f.base[j * f.size + column],
      );
    assert.ok(
      changed > 0.01,
      `stroke must cross x=${x}, even with one movement event`,
    );
  }
});
test("smooth removes local relief and leaves distant marks intact", () => {
  const f = flat();
  f.begin(-3, 0, "comb");
  f.move(3, 0, 4);
  f.end();
  const before = f.height.slice();
  for (let i = 0; i < 15; i++) {
    f.begin(-0.35, 0, "smooth");
    f.move(0.35, 0, 1);
    f.end();
  }
  let beforeCenter = 0,
    afterCenter = 0;
  for (let j = 0; j < f.size; j++)
    for (let i = 0; i < f.size; i++) {
      const k = j * f.size + i,
        x = (i / (f.size - 1) - 0.5) * f.width,
        y = (j / (f.size - 1) - 0.5) * f.depth;
      if (Math.abs(x) > 1.5) assert.equal(f.height[k], before[k]);
      if (Math.abs(x) < 0.2 && Math.abs(y) < 0.2) {
        beforeCenter += Math.abs(before[k] - f.base[k]);
        afterCenter += Math.abs(f.height[k] - f.base[k]);
      }
    }
  assert.ok(afterCenter < beforeCenter * 0.35);
});
test("gather creates a lagging mound and leaves a persistent swirl after settling", () => {
  const f = flat();
  f.begin(0, 0, "gather");
  f.move(0.8, 0, 4);
  f.step(1 / 60);
  assert.ok(f.lagX > 0 && f.lagX < 0.8);
  for (let i = 0; i < 90; i++) f.step(1 / 60);
  assert.ok(Math.max(...f.lift) > 0.1);
  f.end();
  for (let i = 0; i < 300; i++) f.step(1 / 60);
  assert.ok(Math.max(...f.lift) < 0.0002);
  assert.ok(difference(f.height, f.base) > 1, "settling leaves a mark");
});
test("thirty cycles stay bounded; interrupted reset preserves partial progress", () => {
  const f = flat(),
    length = f.pixels.length;
  for (let n = 0; n < 30; n++) {
    const y = Math.sin(n) * 0.7;
    f.begin(-2, y, "comb");
    f.move(2, y + 0.2, 12);
    f.end();
    f.begin(0.6, y, "gather");
    for (let i = 0; i < 12; i++) f.step(1 / 30);
    f.end();
    f.begin(-0.2, y, "smooth");
    f.move(0.2, y, 1);
    f.end();
  }
  assert.equal(f.pixels.length, length);
  assert.ok(
    f.height.every((h) => Number.isFinite(h) && h >= -0.28 && h <= 0.48),
  );
  f.relevel();
  f.step(0.05);
  const partial = f.height.slice();
  f.begin(-4, 2, "comb");
  f.end();
  f.step(0.05);
  assert.equal(f.reset, 0);
  assert.ok(
    difference(partial, f.height) < 5,
    "input interrupts, rather than finishing a reset behind the pointer",
  );
  assert.ok(f.pack());
  assert.equal(f.pack(), false, "idle frames skip texture upload");
});
test("two-minute break pauses with visibility, completes once, and does not lock input", () => {
  const clock = new BreakClock(),
    field = flat();
  clock.start();
  clock.step(65);
  clock.step(90, true);
  assert.equal(clock.elapsed, 65);
  clock.step(55);
  assert.ok(clock.completed);
  assert.equal(clock.running, false);
  clock.step(100);
  assert.equal(clock.elapsed, 120);
  field.begin(0, 0, "comb");
  assert.ok(field.active);
  clock.start();
  assert.equal(clock.completed, false);
});
