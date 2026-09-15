import { Vector3 } from "three";

/** Time-based filtered world-space velocity, independent of event frequency. */
export class PointerVelocity {
  readonly value = new Vector3();
  private previous = new Vector3();
  private sample = new Vector3();
  private timestamp = 0;

  reset(point: Vector3, now: number) {
    this.previous.copy(point);
    this.timestamp = now;
    this.value.set(0, 0, 0);
  }

  update(point: Vector3, now: number) {
    const dt = Math.max((now - this.timestamp) / 1000, 1 / 240);
    this.sample.copy(point).sub(this.previous).divideScalar(dt).clampLength(0, 16);
    this.value.lerp(this.sample, 1 - Math.exp(-24 * dt));
    this.previous.copy(point);
    this.timestamp = now;
  }

  release(now: number) {
    // A fast movement followed by a pause must not fling on release.
    return this.value.multiplyScalar(Math.exp(-Math.max(0, now - this.timestamp - 24) / 75));
  }
}
