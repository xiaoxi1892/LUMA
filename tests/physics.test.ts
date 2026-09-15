import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { createBlobState, deformPoint, stepBlob } from "../lib/blobPhysics.ts";
import { PointerVelocity } from "../hooks/usePointerVelocity.ts";

test("a press displaces the touched patch much more than the opposite surface", () => {
  const rest = createBlobState();
  const pressed = createBlobState();
  pressed.press.value = 0.23;
  const front = new Vector3(0, 0, 1);
  const back = new Vector3(0, 0, -1);
  const frontDelta = deformPoint(front, pressed, new Vector3()).distanceTo(deformPoint(front, rest, new Vector3()));
  const backDelta = deformPoint(back, pressed, new Vector3()).distanceTo(deformPoint(back, rest, new Vector3()));
  assert.ok(frontDelta > 0.2);
  assert.ok(frontDelta > backDelta * 10, "contact should be local, not a global scale");
});

test("released stretching overshoots and settles at multiple frame rates", () => {
  for (const fps of [30, 60, 120]) {
    const state = createBlobState();
    state.drag.set(1.2, 0.6, 0);
    let overshot = false;
    for (let i = 0; i < fps * 4; i++) {
      stepBlob(state, 1 / fps);
      if (state.drag.x < -0.01) overshot = true;
      assert.ok(Number.isFinite(state.drag.x));
      assert.ok(state.drag.length() < 2);
    }
    assert.ok(overshot, `expected elastic overshoot at ${fps} fps`);
    assert.ok(state.drag.length() < 0.001);
    assert.ok(state.center.length() < 0.001);
  }
});

test("a long frame and repeated energetic releases do not destabilize the springs", () => {
  const state = createBlobState();
  for (let i = 0; i < 600; i++) {
    state.pressed = i % 60 < 30;
    state.dragTarget.set(state.pressed ? 1.8 : 0, 0, 0);
    if (i % 60 === 30) state.dragVelocity.set(-6, 0, 0);
    stepBlob(state, i % 90 === 0 ? 8 : 1 / 60);
    assert.ok(Number.isFinite(state.press.value));
    assert.ok(state.drag.length() < 2.6);
    assert.ok(Math.abs(state.press.value) < 0.4);
  }
});

test("holding still before release removes stale pointer velocity", () => {
  const velocity = new PointerVelocity();
  velocity.reset(new Vector3(), 0);
  velocity.update(new Vector3(1, 0, 0), 100);
  assert.ok(velocity.value.length() > 1);
  assert.ok(velocity.release(1100).length() < 0.001);
});
