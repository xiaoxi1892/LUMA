/** Counts only visible, unpaused time. Completion never changes the material. */
export class BreakClock {
  elapsed = 0;
  running = false;
  completed = false;
  start() {
    this.elapsed = 0;
    this.running = true;
    this.completed = false;
  }
  stop() {
    this.running = false;
  }
  step(seconds: number, paused = false) {
    if (!this.running || paused) return;
    this.elapsed = Math.min(120, this.elapsed + Math.max(0, seconds));
    if (this.elapsed >= 120) {
      this.running = false;
      this.completed = true;
    }
  }
}
