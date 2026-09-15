import { SAND, clamp, ease, type SandTool } from "./config.ts";

/** Persistent CPU height field, uploaded as a filterable RGBA8 texture.
 * RG = 16 bit height, BA = local grain direction. No float FBO dependency. */
export class SurfaceField {
  readonly size: number;
  readonly height: Float32Array;
  readonly base: Float32Array;
  readonly direction: Float32Array;
  readonly lift: Float32Array;
  readonly liftVelocity: Float32Array;
  readonly pixels: Uint8Array;
  width = 10.8;
  depth = 7.8;
  dirty = true;
  revision = 0;
  active = false;
  tool: SandTool = "comb";
  x = 0;
  y = 0;
  angle = 0;
  speed = 0;
  lagX = 0;
  lagY = 0;
  reset = 0;
  private resetFrom: Float32Array;
  private lastX = 0;
  private lastY = 0;
  private lifting = false;

  constructor(size: number = SAND.resolution) {
    this.size = size;
    const n = size * size;
    this.height = new Float32Array(n);
    this.base = new Float32Array(n);
    this.direction = new Float32Array(n);
    this.lift = new Float32Array(n);
    this.liftVelocity = new Float32Array(n);
    this.pixels = new Uint8Array(n * 4);
    this.resetFrom = new Float32Array(n);
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const u = i / (size - 1),
          v = j / (size - 1),
          k = j * size + i;
        const base =
          0.028 * Math.sin(u * 6 + v * 3) + 0.017 * Math.cos(v * 8 - u * 2);
        this.base[k] = base;
        // Three low, hand-combed currents. Only initial state, never an idle loop.
        const flow =
          v + 0.11 * Math.sin(u * 5.4 + 0.3) + 0.035 * Math.sin(u * 11);
        const envelope =
          Math.exp(-Math.pow((flow - 0.32) / 0.075, 4)) +
          Math.exp(-Math.pow((flow - 0.61) / 0.09, 4)) +
          0.5 * Math.exp(-Math.pow((flow - 0.84) / 0.038, 4));
        const fade = ease(u / 0.16) * ease((1 - u) / 0.2);
        this.height[k] =
          base +
          Math.sin(flow * Math.min(390, size * 1.3)) * 0.031 * envelope * fade;
        this.direction[k] = Math.atan(-0.6 * Math.cos(u * 5.4 + 0.3));
      }
    this.pack();
  }

  begin(x: number, y: number, tool: SandTool) {
    this.reset = 0;
    this.active = true;
    this.tool = tool;
    this.speed = 0;
    this.x = this.lastX = this.lagX = x;
    this.y = this.lastY = this.lagY = y;
    this.angle = 0;
    this.stamp(x, y, 0, 0, tool, 0.75);
  }

  move(x: number, y: number, speed: number) {
    if (!this.active) return;
    const dx = x - this.lastX,
      dy = y - this.lastY,
      distance = Math.hypot(dx, dy);
    this.x = x;
    this.y = y;
    this.speed = clamp(speed, 0, 12);
    if (distance < 0.001) return;
    let target = Math.atan2(dy, dx);
    // A comb is symmetric under 180 degrees. Avoid a fan when changing direction.
    while (target - this.angle > Math.PI / 2) target -= Math.PI;
    while (target - this.angle < -Math.PI / 2) target += Math.PI;
    const oldAngle = this.angle;
    this.angle += (target - this.angle) * (1 - Math.exp(-distance * 9));
    const steps = Math.min(
      512,
      Math.max(1, Math.ceil(distance / SAND.strokeSpacing)),
    );
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      this.stamp(
        this.lastX + dx * t,
        this.lastY + dy * t,
        oldAngle + (this.angle - oldAngle) * t,
        this.speed,
        this.tool,
        this.tool === "gather" ? 0.23 : 0.45,
      );
    }
    this.lastX = x;
    this.lastY = y;
  }

  end() {
    this.active = false;
    this.speed = 0;
  }

  relevel() {
    this.end();
    this.resetFrom.set(this.height);
    this.reset = 0.00001;
  }

  private stamp(
    x: number,
    y: number,
    angle: number,
    speed: number,
    tool: SandTool,
    strength: number,
  ) {
    const r = SAND.brushRadius[tool],
      n = this.size;
    const minX = clamp(
      Math.floor(((x - r) / this.width + 0.5) * (n - 1)),
      0,
      n - 1,
    );
    const maxX = clamp(
      Math.ceil(((x + r) / this.width + 0.5) * (n - 1)),
      0,
      n - 1,
    );
    const minY = clamp(
      Math.floor(((y - r) / this.depth + 0.5) * (n - 1)),
      0,
      n - 1,
    );
    const maxY = clamp(
      Math.ceil(((y + r) / this.depth + 0.5) * (n - 1)),
      0,
      n - 1,
    );
    const c = Math.cos(angle),
      s = Math.sin(angle);
    for (let j = minY; j <= maxY; j++)
      for (let i = minX; i <= maxX; i++) {
        const dx = (i / (n - 1) - 0.5) * this.width - x;
        const dy = (j / (n - 1) - 0.5) * this.depth - y;
        const d = Math.hypot(dx, dy) / r;
        if (d >= 1) continue;
        const k = j * n + i,
          weight = ease(1 - d),
          b = this.base[k];
        if (tool === "smooth") {
          this.height[k] += (b - this.height[k]) * weight * strength * 0.6;
          this.lift[k] *= 1 - weight * strength;
        } else if (tool === "comb") {
          const across = -dx * s + dy * c;
          const phase = Math.cos((across / SAND.toothSpacing) * Math.PI * 2);
          const tooth = Math.pow(Math.max(0, phase), 2);
          const edge = Math.exp(
            -Math.pow((Math.abs(across) - r * 0.82) / 0.052, 2),
          );
          const target =
            b +
            0.017 -
            tooth * (0.078 + Math.min(speed, 7) * 0.004) +
            edge * (0.035 + Math.min(speed, 7) * 0.005);
          this.height[k] += (target - this.height[k]) * weight * strength;
          this.direction[k] = angle;
        } else {
          const spiral = Math.sin(d * 34 - Math.atan2(dy, dx) * 2) * 0.014;
          const target =
            b +
            weight * 0.17 +
            spiral * weight -
            Math.exp(-Math.pow((d - 0.82) / 0.09, 2)) * 0.046;
          this.height[k] += (target - this.height[k]) * strength * weight;
          this.direction[k] = Math.atan2(dy, dx) + Math.PI * 0.5;
        }
        this.height[k] = clamp(this.height[k], SAND.minHeight, SAND.maxHeight);
      }
    this.dirty = true;
    this.revision++;
  }

  step(delta: number) {
    const dt = Math.min(delta, 0.05);
    if (this.reset > 0) {
      this.reset += dt / SAND.resetSeconds;
      const t = ease(this.reset);
      for (let k = 0; k < this.height.length; k++) {
        this.height[k] = this.resetFrom[k] * (1 - t) + this.base[k] * t;
        this.lift[k] *= 1 - t;
      }
      this.dirty = true;
      if (this.reset >= 1) this.reset = 0;
    }
    const gathering = this.active && this.tool === "gather";
    if (gathering) {
      const follow = 1 - Math.exp(-10 * dt);
      this.lagX += (this.x - this.lagX) * follow;
      this.lagY += (this.y - this.lagY) * follow;
      this.stamp(
        this.lagX,
        this.lagY,
        this.angle,
        this.speed,
        "gather",
        dt * 7,
      );
      this.lifting = true;
    }
    if (this.lifting) {
      let activity = 0;
      for (let j = 0; j < this.size; j++)
        for (let i = 0; i < this.size; i++) {
          const k = j * this.size + i;
          const dx = (i / (this.size - 1) - 0.5) * this.width - this.lagX;
          const dy = (j / (this.size - 1) - 0.5) * this.depth - this.lagY;
          const target = gathering
            ? Math.exp(-(dx * dx + dy * dy) / 0.14) * 0.18
            : 0;
          this.liftVelocity[k] +=
            ((target - this.lift[k]) * 46 - this.liftVelocity[k] * 13) * dt;
          this.lift[k] += this.liftVelocity[k] * dt;
          activity = Math.max(
            activity,
            Math.abs(this.lift[k]) + Math.abs(this.liftVelocity[k]),
          );
        }
      this.dirty = true;
      if (!gathering && activity < 0.0001) {
        this.lifting = false;
        this.lift.fill(0);
        this.liftVelocity.fill(0);
      }
    }
  }

  pack() {
    if (!this.dirty) return false;
    for (let k = 0; k < this.height.length; k++) {
      const h = Math.round(
        clamp(this.height[k] + this.lift[k] + 0.5, 0, 1) * 65535,
      );
      this.pixels[k * 4] = h >> 8;
      this.pixels[k * 4 + 1] = h & 255;
      this.pixels[k * 4 + 2] = Math.round(
        (Math.cos(this.direction[k]) * 0.5 + 0.5) * 255,
      );
      this.pixels[k * 4 + 3] = Math.round(
        (Math.sin(this.direction[k]) * 0.5 + 0.5) * 255,
      );
    }
    this.dirty = false;
    return true;
  }
}
