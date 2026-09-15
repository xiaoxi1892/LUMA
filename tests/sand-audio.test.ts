import { test } from "node:test";
import assert from "node:assert/strict";
import { TactileAudioEngine } from "../audio/playground/TactileAudioEngine.ts";
import { SandAudioEngine } from "../audio/sand/SandAudioEngine.ts";

test("audio is opt-in, decoded once, bounded, and stays blocked after interruption", async () => {
  let contexts = 0,
    requests = 0;
  const savedContext = globalThis.AudioContext,
    savedFetch = globalThis.fetch;
  const parameter = () => ({
    value: 0,
    setTargetAtTime() {},
    setValueAtTime() {},
    linearRampToValueAtTime() {},
  });
  const node = () => ({
    connect(other: unknown) {
      return other;
    },
    disconnect() {},
  });
  class Context {
    state = "suspended";
    currentTime = 2;
    destination = {};
    constructor() {
      contexts++;
    }
    createGain() {
      return { ...node(), gain: parameter() };
    }
    createBiquadFilter() {
      return {
        ...node(),
        type: "lowpass",
        frequency: parameter(),
        Q: parameter(),
      };
    }
    createBufferSource() {
      return {
        ...node(),
        buffer: null,
        loop: false,
        playbackRate: parameter(),
        start() {},
        stop() {},
        onended: null,
      };
    }
    async decodeAudioData() {
      return { duration: 4.4 };
    }
    async resume() {
      this.state = "running";
    }
    async suspend() {
      this.state = "suspended";
    }
    async close() {
      this.state = "closed";
    }
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  globalThis.fetch = (async () => {
    requests++;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  }) as unknown as typeof fetch;
  const engine = new SandAudioEngine();
  const material = new TactileAudioEngine();
  try {
    engine.update(8, true, "comb");
    await engine.gesture();
    assert.equal(contexts, 0);
    assert.ok(await engine.enable());
    assert.equal(contexts, 1);
    assert.equal(requests, 4);
    for (let i = 0; i < 30; i++) {
      engine.disable();
      await engine.enable();
      engine.update(12, true, "comb");
      engine.release("gather");
    }
    assert.equal(contexts, 1);
    assert.equal(requests, 4);
    assert.equal(engine.diagnostics().loopVoices, 3);
    assert.equal(engine.diagnostics().settlingVoices, 1);
    engine.interrupt();
    engine.update(12, true, "gather");
    assert.ok(engine.diagnostics().blocked);
    await engine.gesture();
    assert.equal(engine.diagnostics().blocked, false);
    engine.disable();
    await engine.gesture();
    assert.equal(engine.diagnostics().enabled, false);
    // The shared product must not create a context when merely changing modes.
    material.select("beads");
    material.event({ kind: "collision", energy: 1, count: 900, speed: 15 });
    assert.equal(contexts, 1);
    assert.ok(await material.enable());
    assert.equal(contexts, 2);
    assert.equal(requests, 15);
    for (let i = 0; i < 400; i++)
      material.event({ kind: "collision", energy: 1, count: 900, speed: 15 });
    assert(material.diagnostics().materialVoices <= 3);
    assert.equal(material.diagnostics().decodedMaterials, 7);
    material.select("bubble");
    material.disable();
    await material.gesture();
    assert.equal(material.diagnostics().enabled, false);
    await material.enable();
    assert.equal(contexts, 2);
    assert.equal(requests, 15);
  } finally {
    material.dispose();
    engine.dispose();
    globalThis.AudioContext = savedContext;
    globalThis.fetch = savedFetch;
  }
});
