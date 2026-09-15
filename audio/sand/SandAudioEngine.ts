import type { SandTool } from "../../lib/sand/config.ts";
import { publicAsset } from "../../lib/publicAsset.ts";

export const SAMPLE_PATHS = [
  "/audio/brush-1.wav",
  "/audio/brush-2.wav",
  "/audio/brush-3.wav",
  "/audio/settle.wav",
] as const;
const RATES = [0.97, 1, 1.02];
const MASTER_LIMIT = 0.5;
type Layer = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
};

/** Real recorded textures, bounded to three continuous layers + one settling voice.
 * Explicit enable is the only method that creates an AudioContext. */
export class SandAudioEngine {
  enabled = false;
  ready = false;
  blocked = false;
  volume = 0.45;
  protected context: AudioContext | null = null;
  protected master: GainNode | null = null;
  private layers: Layer[] = [];
  private buffers: AudioBuffer[] = [];
  private settling: AudioBufferSourceNode | null = null;
  private lastSettle = -10;
  private lastUpdate = -10;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private loading: Promise<void> | null = null;
  private disposed = false;
  private recordings: MediaRecorder[] = [];

  async enable() {
    if (this.disposed) return false;
    this.enabled = true;
    this.blocked = false;
    if (this.suspendTimer) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    try {
      if (!this.context) {
        const ctx = new AudioContext({ latencyHint: "interactive" });
        this.context = ctx;
        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        this.master = master;
        this.loading = Promise.all(
          SAMPLE_PATHS.map(async (path) => {
            const response = await fetch(publicAsset(path));
            if (!response.ok) throw new Error("Material audio unavailable");
            return ctx.decodeAudioData(await response.arrayBuffer());
          }),
        ).then((buffers) => {
          if (this.disposed) return;
          this.buffers = buffers;
          for (let i = 0; i < 3; i++) {
            const source = ctx.createBufferSource(),
              gain = ctx.createGain(),
              filter = ctx.createBiquadFilter();
            source.buffer = buffers[i];
            source.loop = true;
            source.playbackRate.value = RATES[i];
            filter.type = "lowpass";
            filter.frequency.value = 2800;
            filter.Q.value = 0.4;
            gain.gain.value = 0;
            source.connect(filter).connect(gain).connect(master);
            source.start(0, i * 0.71);
            this.layers.push({ source, gain, filter });
          }
          this.ready = true;
        });
      }
      // Resume inside the explicit gesture, before waiting for network decoding.
      await this.context.resume();
      await this.loading;
      if (!this.enabled || this.blocked || this.disposed) {
        this.enabled = false;
        this.quiet();
        return false;
      }
      this.master?.gain.setTargetAtTime(
        this.volume * MASTER_LIMIT,
        this.context.currentTime,
        0.1,
      );
      return true;
    } catch {
      this.enabled = false;
      this.ready = false;
      this.quiet();
      // A failed load is retryable. Do not retain a rejected promise/context.
      if (this.context) void this.context.close();
      this.context = null;
      this.master = null;
      this.loading = null;
      return false;
    }
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.context && this.master && this.enabled && !this.blocked)
      this.master.gain.setTargetAtTime(
        this.volume * MASTER_LIMIT,
        this.context.currentTime,
        0.08,
      );
  }
  /** Stop surface friction immediately when its world is left, bypassing the
   * per-frame update throttle without suspending the shared audio context. */
  protected stopTexture() {
    if (!this.context) return;
    for (const layer of this.layers)
      layer.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.045);
  }
  disable() {
    this.enabled = false;
    this.quiet();
  }
  interrupt() {
    this.blocked = true;
    this.quiet();
  }
  async gesture() {
    if (!this.enabled || !this.context || this.disposed) return;
    this.blocked = false;
    if (this.suspendTimer) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    try {
      await this.context.resume();
      if (this.enabled && !this.blocked)
        this.master?.gain.setTargetAtTime(
          this.volume * MASTER_LIMIT,
          this.context.currentTime,
          0.1,
        );
    } catch {
      /* silent fallback */
    }
  }
  update(speed: number, active: boolean, tool: SandTool) {
    const ctx = this.context;
    if (
      !ctx ||
      !this.enabled ||
      !this.ready ||
      this.blocked ||
      ctx.state !== "running"
    )
      return;
    const t = ctx.currentTime;
    if (t - this.lastUpdate < 1 / 30) return;
    this.lastUpdate = t;
    const motion = Math.min(1, Math.max(0, speed) / 4);
    const friction = active
      ? tool === "gather"
        ? 0.3 + motion * 0.35
        : Math.sqrt(motion) * 0.8
      : 0;
    const cutoff =
      (tool === "smooth" ? 1500 : tool === "gather" ? 2100 : 2900) +
      motion * 1000;
    // Three phase-shifted cosines sum to a constant; no abrupt sample switching.
    for (let i = 0; i < 3; i++) {
      const weight = (1 + Math.cos(t * 0.61 + (i * Math.PI * 2) / 3)) / 3;
      this.layers[i]?.gain.gain.setTargetAtTime(
        friction * weight,
        t,
        active ? 0.065 : 0.16,
      );
      this.layers[i]?.filter.frequency.setTargetAtTime(cutoff, t, 0.13);
    }
  }
  release(tool: SandTool) {
    const ctx = this.context;
    if (
      !ctx ||
      !this.master ||
      !this.enabled ||
      !this.ready ||
      this.blocked ||
      this.settling ||
      ctx.currentTime - this.lastSettle < 0.65
    )
      return;
    const now = ctx.currentTime;
    this.lastSettle = now;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    source.buffer = this.buffers[3];
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(
      tool === "gather" ? 0.24 : 0.09,
      now + 0.025,
    );
    gain.gain.setTargetAtTime(0, now + 0.09, 0.18);
    source.connect(gain).connect(this.master);
    this.settling = source;
    source.start();
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (this.settling === source) this.settling = null;
    };
  }
  private quiet() {
    const ctx = this.context;
    if (!ctx) return;
    this.master?.gain.setTargetAtTime(0, ctx.currentTime, 0.045);
    for (const l of this.layers)
      l.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.suspendTimer = setTimeout(() => {
      if (this.context?.state === "running") void this.context.suspend();
      this.suspendTimer = null;
    }, 250);
  }
  diagnostics() {
    return {
      contexts: this.context ? 1 : 0,
      loopVoices: this.layers.length,
      settlingVoices: this.settling ? 1 : 0,
      enabled: this.enabled,
      ready: this.ready,
      blocked: this.blocked,
      state: this.context?.state ?? "not-created",
    };
  }

  /** Developer-only capture of our own audio graph + our own WebGL canvas.
   * No getUserMedia, microphone, camera, or desktop capture. */
  capture(
    canvas: HTMLCanvasElement,
    seconds = 20,
  ): Promise<{ audio: Blob; video: Blob }> {
    const ctx = this.context;
    if (!ctx || !this.master || !this.enabled) throw new Error("请先开启声音");
    const destination = ctx.createMediaStreamDestination();
    this.master.connect(destination);
    const visual = canvas.captureStream(30);
    const combined = new MediaStream([
      ...visual.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);
    const make = (stream: MediaStream, mimeType: string) =>
      new Promise<Blob>((resolve, reject) => {
        const chunks: BlobPart[] = [];
        const recorder = new MediaRecorder(stream, { mimeType });
        this.recordings.push(recorder);
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.onerror = () => reject(new Error("录制不可用"));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder.start();
        setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, seconds * 1000);
      });
    return Promise.all([
      make(destination.stream, "audio/webm;codecs=opus"),
      make(combined, "video/webm;codecs=vp9,opus"),
    ])
      .then(([audio, video]) => ({ audio, video }))
      .finally(() => {
        this.master?.disconnect(destination);
        destination.disconnect();
        visual.getTracks().forEach((t) => t.stop());
        destination.stream.getTracks().forEach((t) => t.stop());
        this.recordings = [];
      });
  }
  dispose() {
    this.disposed = true;
    this.enabled = false;
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    for (const r of this.recordings) if (r.state !== "inactive") r.stop();
    for (const l of this.layers) {
      l.source.stop();
      l.source.disconnect();
      l.gain.disconnect();
      l.filter.disconnect();
    }
    this.settling?.stop();
    this.layers = [];
    this.buffers = [];
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
  }
}
