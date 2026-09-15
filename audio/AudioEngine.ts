import type { SoundEvent } from "../lib/matter/types.ts";

/** Quiet procedural material sounds. Nothing is created until a user gesture. */
export class AudioEngine {
  enabled = true;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private tension: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private lastTouch = 0;

  async wake() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const ctx = new AudioContext();
        this.context = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0.25;
        this.master.connect(ctx.destination);
        this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < data.length; i++) { previous = (previous + (Math.random() * 2 - 1) * 0.07) / 1.02; data[i] = previous * 3; }
        const source = ctx.createBufferSource(); source.buffer = this.noise; source.loop = true;
        this.filter = ctx.createBiquadFilter(); this.filter.type = "bandpass"; this.filter.frequency.value = 300; this.filter.Q.value = 0.5;
        this.tension = ctx.createGain(); this.tension.gain.value = 0;
        source.connect(this.filter).connect(this.tension).connect(this.master); source.start();
        this.chargeOsc = ctx.createOscillator(); this.chargeOsc.type = "sine"; this.chargeOsc.frequency.value = 82;
        this.chargeGain = ctx.createGain(); this.chargeGain.gain.value = 0;
        this.chargeOsc.connect(this.chargeGain).connect(this.master); this.chargeOsc.start();
      }
      if (this.context.state === "suspended") await this.context.resume();
    } catch { /* Visual interaction stays available when audio is blocked. */ }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.context && this.master) this.master.gain.setTargetAtTime(enabled ? 0.25 : 0, this.context.currentTime, 0.08);
    if (enabled) void this.wake();
  }

  update(speed: number, stretch: number, charge: number, field: number) {
    const ctx = this.context;
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime;
    this.tension?.gain.setTargetAtTime(Math.min(0.032, speed * 0.0015 + stretch * 0.009 + field * speed * 0.0008), t, 0.12);
    this.filter?.frequency.setTargetAtTime(160 + Math.min(speed, 12) * 70 + charge * 400, t, 0.12);
    this.chargeOsc?.frequency.setTargetAtTime(82 + charge * 90, t, 0.15);
    this.chargeGain?.gain.setTargetAtTime(charge * charge * 0.04, t, 0.12);
  }

  play(event: SoundEvent, intensity = 1) {
    const ctx = this.context;
    if (!ctx || !this.master || !this.enabled || ctx.state !== "running") return;
    const now = ctx.currentTime;
    if (event === "touch" && now - this.lastTouch < 0.055) return;
    if (event === "touch") this.lastTouch = now;
    const settings = {
      touch: [280, 92, 0.14, 0.035], detach: [560, 140, 0.12, 0.045],
      merge: [150, 52, 0.32, 0.055], split: [210, 73, 0.42, 0.045],
      bloom: [78, 33, 1.05, 0.11],
    }[event];
    const [from, to, duration, gain] = settings;
    const osc = ctx.createOscillator(), envelope = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + duration);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(gain * Math.min(1, intensity), now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(envelope).connect(this.master); osc.start(now); osc.stop(now + duration + 0.02);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
    if (event === "bloom" && this.noise) {
      const air = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), fade = ctx.createGain();
      air.buffer = this.noise; filter.type = "lowpass"; filter.frequency.value = 850;
      fade.gain.setValueAtTime(0, now); fade.gain.linearRampToValueAtTime(0.05, now + 0.08); fade.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
      air.connect(filter).connect(fade).connect(this.master); air.start(); air.stop(now + 1);
      air.onended = () => { air.disconnect(); filter.disconnect(); fade.disconnect(); };
    }
  }

  dispose() { if (this.context) void this.context.close(); this.context = null; }
}
