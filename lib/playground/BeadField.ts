export interface Bead {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  mass: number;
  seed: number;
  spin: number;
}
/** Bounded 3D beads, fixed substeps, spatial buckets, positional contacts + impulses.
 * All state remains on the CPU when its renderer is unmounted. */
export class BeadField {
  beads: Bead[] = [];
  width = 12;
  depth = 7.8;
  active = false;
  x = 100;
  y = 100;
  speed = 0;
  polarity = 0;
  time = 0;
  collisionCount = 0;
  collisionImpulse = 0;
  collisionSpeed = 0;
  throws = 0;
  private accumulator = 0;
  private grips: Float32Array = new Float32Array(0);
  constructor(count = 264) {
    this.initialize(count);
  }
  private initialize(count: number) {
    this.beads = [];
    this.grips = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const seed = ((i * 7919 + 137) % 997) / 997,
        angle = i * 2.39996323,
        rad = Math.sqrt((i + 0.5) / count);
      const r = 0.125 + seed * 0.073;
      this.beads.push({
        x: Math.cos(angle) * rad * this.width * 0.34,
        y: Math.sin(angle) * rad * this.depth * 0.34,
        z: r + 0.025,
        vx: 0,
        vy: 0,
        vz: 0,
        r,
        mass: Math.pow(r / 0.16, 3),
        seed,
        spin: seed * 6.28,
      });
    }
    for (let i = 0; i < 24; i++) this.contacts(false);
    this.clearAudio();
  }
  layout(width: number, depth: number) {
    if (
      Math.abs(width - this.width) < 0.01 &&
      Math.abs(depth - this.depth) < 0.01
    )
      return;
    const sx = width / this.width,
      sy = depth / this.depth;
    for (const b of this.beads) {
      b.x *= sx;
      b.y *= sy;
    }
    this.width = width;
    this.depth = depth;
    for (let i = 0; i < 12; i++) this.contacts(false);
  }
  begin(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.active = true;
    this.beads.forEach((b, i) => {
      this.grips[i] = Math.exp(-((b.x - x) ** 2 + (b.y - y) ** 2) / 1.8);
    });
  }
  move(x: number, y: number, speed: number) {
    this.x = x;
    this.y = y;
    this.speed = Math.min(16, speed);
  }
  end(release = true, vx = 0, vy = 0) {
    if (this.active && release) {
      const speed = Math.hypot(vx, vy),
        cap = Math.min(1, 11 / Math.max(speed, 0.001));
      if (speed > 1.8) this.throws++;
      for (let i = 0; i < this.beads.length; i++) {
        const b = this.beads[i],
          d = Math.hypot(b.x - this.x, b.y - this.y),
          weight =
            Math.max(Math.exp((-d * d) / 0.95), this.grips[i] * 0.85) *
            (0.65 + b.seed * 0.25);
        b.vx += vx * cap * weight;
        b.vy += vy * cap * weight;
        b.vz += Math.min(1.1, speed * 0.07) * weight;
      }
    }
    this.active = false;
    this.speed = 0;
    this.grips.fill(0);
  }
  repel() {
    if (
      Math.abs(this.x) > this.width / 2 ||
      Math.abs(this.y) > this.depth / 2
    ) {
      this.x = 0;
      this.y = 0;
    }
    this.polarity = 2.4;
  }
  step(delta: number) {
    this.accumulator += Math.min(0.05, Math.max(0, delta));
    while (this.accumulator >= 1 / 120) {
      this.integrate(1 / 120);
      this.accumulator -= 1 / 120;
    }
  }
  private integrate(dt: number) {
    this.time += dt;
    this.polarity = Math.max(0, this.polarity - dt);
    for (let i = 0; i < this.beads.length; i++) {
      const b = this.beads[i],
        dx = this.x - b.x,
        dy = this.y - b.y,
        d2 = dx * dx + dy * dy,
        d = Math.sqrt(d2),
        field = Math.exp(-d2 / (this.active ? 5.2 : 2.1));
      let strength = 0;
      if (this.polarity > 0)
        strength = -17 * Math.min(1, this.polarity) * Math.exp(-d2 / 5.8);
      else if (this.active)
        strength = Math.min(
          34,
          (8 + d * 11) * field + this.grips[i] * Math.min(40, d * 24),
        );
      else if (d > 0.13) strength = 0.22 * field;
      const massResistance = 1 / Math.sqrt(b.mass);
      b.vx += (dx / Math.max(0.2, d)) * strength * dt * massResistance;
      b.vy += (dy / Math.max(0.2, d)) * strength * dt * massResistance;
      // A shallow magnetic mound gives the cluster volume, contacts prevent a singularity.
      const mound =
        this.active && this.polarity === 0 ? 0.85 * Math.exp(-d2 / 0.6) : 0;
      b.vz += ((b.r + 0.022 + mound - b.z) * 30 - b.vz * 7) * dt;
      const damping = Math.exp(-dt * (this.active ? 3.8 : 1.65));
      b.vx *= damping;
      b.vy *= damping;
      const speed = Math.hypot(b.vx, b.vy, b.vz);
      if (speed > 13) {
        b.vx *= 13 / speed;
        b.vy *= 13 / speed;
        b.vz *= 13 / speed;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.spin += (Math.hypot(b.vx, b.vy) * dt) / b.r;
    }
    for (let i = 0; i < 3; i++) this.contacts(i === 0);
    for (const b of this.beads) {
      const bx = this.width * 0.485 - b.r,
        by = this.depth * 0.485 - b.r;
      if (Math.abs(b.x) > bx) {
        b.x = Math.sign(b.x) * bx;
        b.vx *= -0.28;
      }
      if (Math.abs(b.y) > by) {
        b.y = Math.sign(b.y) * by;
        b.vy *= -0.28;
      }
      if (b.z < b.r + 0.015) {
        b.z = b.r + 0.015;
        b.vz = Math.max(0, b.vz) * 0.25;
      }
      if (!this.active && Math.hypot(b.vx, b.vy) < 0.012) {
        b.vx = 0;
        b.vy = 0;
      }
    }
  }
  private contacts(record: boolean) {
    const size = 0.42,
      buckets = new Map<number, number[]>();
    for (let i = 0; i < this.beads.length; i++) {
      const b = this.beads[i],
        key =
          (Math.floor(b.x / size) + 128) * 65536 +
          (Math.floor(b.y / size) + 128) * 256 +
          Math.floor(b.z / size) +
          128;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(i);
      else buckets.set(key, [i]);
    }
    for (let i = 0; i < this.beads.length; i++) {
      const a = this.beads[i],
        gx = Math.floor(a.x / size),
        gy = Math.floor(a.y / size),
        gz = Math.floor(a.z / size);
      for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
          for (let z = -1; z <= 1; z++) {
            const bucket = buckets.get(
              (gx + x + 128) * 65536 + (gy + y + 128) * 256 + gz + z + 128,
            );
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i) continue;
              const b = this.beads[j];
              let dx = b.x - a.x,
                dy = b.y - a.y,
                dz = b.z - a.z;
              const min = a.r + b.r + 0.009,
                dist2 = dx * dx + dy * dy + dz * dz;
              if (dist2 >= min * min) continue;
              const d = Math.sqrt(dist2);
              if (d < 1e-7) {
                dx = 1;
                dy = 0;
                dz = 0;
              } else {
                dx /= d;
                dy /= d;
                dz /= d;
              }
              const invA = 1 / a.mass,
                invB = 1 / b.mass,
                total = invA + invB,
                correction = Math.max(0, min - d - 0.001) * 0.75;
              a.x -= (dx * correction * invA) / total;
              a.y -= (dy * correction * invA) / total;
              a.z -= (dz * correction * invA) / total;
              b.x += (dx * correction * invB) / total;
              b.y += (dy * correction * invB) / total;
              b.z += (dz * correction * invB) / total;
              const approach =
                (b.vx - a.vx) * dx + (b.vy - a.vy) * dy + (b.vz - a.vz) * dz;
              if (approach < 0) {
                const impulse = (-approach * 1.24) / total;
                a.vx -= dx * impulse * invA;
                a.vy -= dy * impulse * invA;
                a.vz -= dz * impulse * invA;
                b.vx += dx * impulse * invB;
                b.vy += dy * impulse * invB;
                b.vz += dz * impulse * invB;
                if (record && approach < -0.12) {
                  this.collisionCount++;
                  this.collisionImpulse += impulse;
                  this.collisionSpeed -= approach;
                }
              }
            }
          }
    }
  }
  clearAudio() {
    this.collisionCount = this.collisionImpulse = this.collisionSpeed = 0;
  }
  reset() {
    this.end(false);
    this.polarity = 0;
    this.initialize(this.beads.length);
  }
}
