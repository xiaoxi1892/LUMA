import { SandAudioEngine } from "../sand/SandAudioEngine.ts";
import { publicAsset } from "../../lib/publicAsset.ts";
import type { MaterialMode, MaterialSound } from "../../lib/playground/types";
export const MATERIAL_SAMPLES = [
  "/audio/cell-1.wav",
  "/audio/cell-2.wav",
  "/audio/cell-3.wav",
  "/audio/bead-1.wav",
  "/audio/bead-2.wav",
  "/audio/bead-3.wav",
  "/audio/bead-roll.wav",
] as const;
type Voice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
};
/** One shared AudioContext. Different recordings, bounded voices, no collision-per-voice.
 * Maximum mixed sample amplitude is bounded before the already quiet master gain. */
export class TactileAudioEngine extends SandAudioEngine {
  mode: MaterialMode = "sand";
  private materialBuffers: AudioBuffer[] = [];
  private materialLoading: Promise<void> | null = null;
  private voices = new Set<Voice>();
  private lastEvent = -10;
  private sequence = 0;
  override async enable() {
    if (!(await super.enable())) return false;
    const ctx = this.context;
    if (!ctx) return false;
    try {
      if (!this.materialLoading)
        this.materialLoading = Promise.all(
          MATERIAL_SAMPLES.map(async (path) => {
            const r = await fetch(publicAsset(path));
            if (!r.ok) throw new Error("Audio unavailable");
            return ctx.decodeAudioData(await r.arrayBuffer());
          }),
        ).then((b) => {
          if (this.context === ctx) this.materialBuffers = b;
        });
      await this.materialLoading;
      return this.enabled && !this.blocked;
    } catch {
      this.materialLoading = null;
      this.disable();
      return false;
    }
  }
  select(mode: MaterialMode) {
    this.stopTexture();
    this.mode = mode;
    this.silenceVoices();
    this.lastEvent = -10;
  }
  event(event: MaterialSound) {
    const ctx = this.context,
      master = this.master;
    if (
      !ctx ||
      !master ||
      !this.enabled ||
      this.blocked ||
      ctx.state !== "running" ||
      this.materialBuffers.length !== 7 ||
      this.mode === "sand"
    )
      return;
    const now = ctx.currentTime,
      cooldown = this.mode === "bubble" ? 0.095 : 0.115;
    if (now - this.lastEvent < cooldown || this.voices.size >= 3) return;
    this.lastEvent = now;
    this.sequence++;
    const rolling = this.mode === "beads" && event.count > 8;
    const index =
      this.mode === "bubble"
        ? this.sequence % 3
        : rolling
          ? 6
          : 3 + (this.sequence % 3);
    const source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      filter = ctx.createBiquadFilter();
    source.buffer = this.materialBuffers[index];
    source.playbackRate.value =
      this.mode === "bubble"
        ? event.kind === "release"
          ? 0.76
          : 0.91 + Math.min(0.15, event.speed * 0.01)
        : 0.9 + (this.sequence % 4) * 0.045;
    filter.type = "lowpass";
    filter.Q.value = 0.45;
    filter.frequency.value =
      this.mode === "bubble" ? 1350 + Math.min(500, event.energy * 500) : 2400;
    const energy = Math.min(1, Math.max(0, event.energy));
    // Log-density and mean impact speed change a single texture's intensity, never voice count.
    const density = Math.min(1, Math.log1p(event.count) / 4),
      speed = Math.min(1, event.speed / 4);
    const level =
      this.mode === "bubble"
        ? 0.17 + energy * 0.22
        : 0.1 + energy * 0.12 + density * 0.07 + speed * 0.035;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.012);
    gain.gain.setTargetAtTime(0, now + 0.045, rolling ? 0.085 : 0.07);
    source.connect(filter).connect(gain).connect(master);
    const voice = { source, gain, filter };
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    source.start(now, rolling ? (this.sequence % 4) * 0.31 : 0);
    source.stop(now + (rolling ? 0.32 : 0.42));
  }
  private silenceVoices() {
    if (!this.context) return;
    const t = this.context.currentTime;
    for (const voice of this.voices) {
      voice.gain.gain.setTargetAtTime(0, t, 0.015);
      try {
        voice.source.stop(t + 0.08);
      } catch {
        /* already ended */
      }
    }
  }
  override interrupt() {
    this.silenceVoices();
    super.interrupt();
  }
  override disable() {
    this.silenceVoices();
    super.disable();
  }
  override diagnostics() {
    return {
      ...super.diagnostics(),
      materialVoices: this.voices.size,
      decodedMaterials: this.materialBuffers.length,
      material: this.mode,
    };
  }
  override dispose() {
    this.silenceVoices();
    this.materialBuffers = [];
    this.materialLoading = null;
    super.dispose();
  }
}
