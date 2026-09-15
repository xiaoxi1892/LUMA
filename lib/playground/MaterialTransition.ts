export type Mode = "sand" | "bubble" | "beads";
export const modeWeights = (mode: Mode): [number, number, number] =>
  mode === "sand" ? [1, 0, 0] : mode === "bubble" ? [0, 1, 0] : [0, 0, 1];
/** Transitions interpolate geometry/material coefficients; they never fade worlds. */
export class MaterialTransition {
  from: Mode = "sand";
  to: Mode = "sand";
  elapsed = 0;
  duration = 1.55;
  active = false;
  start(from: Mode, to: Mode, reduced = false) {
    this.from = from;
    this.to = to;
    this.elapsed = 0;
    this.duration = reduced ? 0.12 : 1.55;
    this.active = from !== to;
  }
  step(dt: number) {
    if (this.active) {
      this.elapsed = Math.min(this.duration, this.elapsed + Math.min(0.05, dt));
      if (this.elapsed >= this.duration) this.active = false;
    }
  }
  skip() {
    this.elapsed = this.duration;
    this.active = false;
  }
  weights(): [number, number, number] {
    const t = Math.min(1, this.elapsed / this.duration),
      ease = t * t * (3 - 2 * t),
      a = modeWeights(this.from),
      b = modeWeights(this.to);
    return a.map((v, i) => v + (b[i] - v) * ease) as [number, number, number];
  }
}
