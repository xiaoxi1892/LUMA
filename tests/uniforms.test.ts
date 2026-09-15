import { test } from "node:test";
import assert from "node:assert/strict";
import { applyProps } from "@react-three/fiber";
import { ShaderMaterial } from "three";
import { createBlobState, stepBlob } from "../lib/blobPhysics.ts";
import { createBlobUniforms, syncBlobUniforms } from "../lib/blobUniforms.ts";

test("press, hover and time reach R3F's actual material uniforms", () => {
  const state = createBlobState();
  const props = createBlobUniforms(state);
  const material = new ShaderMaterial();
  // Reproduce the renderer boundary that the original CPU-only tests missed.
  applyProps(material, { uniforms: props });
  state.pressed = true;
  state.proximityTarget = 1;
  for (let i = 0; i < 12; i++) {
    state.time += 1 / 60;
    stepBlob(state, 1 / 60);
    syncBlobUniforms(material, state);
  }
  assert.ok(material.uniforms.uTime.value > 0.19, "ambient time must advance on the material");
  assert.ok(material.uniforms.uPress.value > 0.15, "the shader must receive the indentation");
  assert.ok(material.uniforms.uProximity.value > 0.7, "hover must reach the shader");
  state.pressed = false;
  state.releaseTime = state.time;
  state.releaseStrength = 0.6;
  syncBlobUniforms(material, state);
  assert.equal(material.uniforms.uReleaseTime.value, state.time);
  assert.equal(material.uniforms.uReleaseStrength.value, 0.6);
  for (let i = 0; i < 120; i++) {
    stepBlob(state, 1 / 60);
    syncBlobUniforms(material, state);
  }
  assert.ok(Math.abs(material.uniforms.uPress.value) < 0.001, "the displayed dent must recover");
  material.dispose();
});
