/** A spring lattice: pressure is local within each cap; cells exchange tension.
 * History lives here, outside the mounted renderer. No global scale animation. */
export interface Cell {
  x: number;
  y: number;
  radius: number;
  depth: number;
  velocity: number;
  touchX: number;
  touchY: number;
  bendX: number;
  bendY: number;
  memory: number;
  lastPress: number;
  stiffness: number;
  damping: number;
}
export class BubbleField {
  cells: Cell[] = [];
  width = 12;
  depth = 7.8;
  active = false;
  x = 0;
  y = 0;
  speed = 0;
  held = 0;
  time = 0;
  presses = 0;
  releaseEnergy = 0;
  waveCount = 0;
  waves: { x: number; y: number; time: number; strength: number }[] = [];
  private density: { x: number; y: number; time: number }[] = [];
  private neighbors: number[][] = [];
  layout(width: number, depth: number) {
    if (
      this.cells.length &&
      Math.abs(width - this.width) < 0.01 &&
      Math.abs(depth - this.depth) < 0.01
    )
      return;
    const old = this.cells;
    this.width = width;
    this.depth = depth;
    const cols = Math.max(5, Math.round(width / (width < 7 ? 1.0 : 0.86))),
      rows = Math.max(5, Math.round(depth / (width < 7 ? 0.98 : 0.81)));
    const sx = (width - 0.85) / cols,
      sy = (depth - 0.8) / rows;
    this.cells = [];
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const i = this.cells.length,
          history =
            old[Math.floor((i / Math.max(1, cols * rows)) * old.length)];
        this.cells.push({
          x: (col - (cols - 1) / 2 + (row % 2 ? 0.23 : -0.23)) * sx,
          y: (row - (rows - 1) / 2) * sy,
          radius: Math.min(sx, sy) * 0.46,
          depth: history?.depth ?? 0,
          velocity: 0,
          touchX: 0,
          touchY: 0,
          bendX: 0,
          bendY: 0,
          memory: history?.memory ?? 0,
          lastPress: -10,
          stiffness: 52 + ((i * 17) % 19),
          damping: 6.5 + ((i * 11) % 9) * 0.22,
        });
      }
    this.neighbors = this.cells.map((c, i) =>
      this.cells.flatMap((b, j) =>
        i !== j && Math.hypot(c.x - b.x, c.y - b.y) < Math.max(sx, sy) * 1.35
          ? [j]
          : [],
      ),
    );
  }
  begin(x: number, y: number) {
    this.active = true;
    this.held = 0;
    this.x = x;
    this.y = y;
    this.stamp(x, y, 0);
  }
  move(x: number, y: number, speed: number) {
    this.speed = Math.min(16, speed);
    if (this.active) {
      const distance = Math.hypot(x - this.x, y - this.y),
        n = Math.min(140, Math.max(1, Math.ceil(distance / 0.13)));
      if (distance > 0.1) this.held *= Math.exp(-distance * 2);
      for (let i = 1; i <= n; i++)
        this.stamp(
          this.x + ((x - this.x) * i) / n,
          this.y + ((y - this.y) * i) / n,
          this.speed,
        );
    }
    this.x = x;
    this.y = y;
  }
  private stamp(x: number, y: number, speed: number) {
    for (const c of this.cells) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d > c.radius * 1.4) continue;
      const w = Math.exp(((-d * d) / (c.radius * c.radius)) * 1.8);
      if (w < 0.25) continue;
      c.touchX = speed > 1.5 ? 0 : (x - c.x) / c.radius;
      c.touchY = speed > 1.5 ? 0 : (y - c.y) / c.radius;
      // A trajectory enters a cap at its edge first. Keep the strongest sampled
      // pressure, otherwise that weak first stamp would lock out its center.
      c.depth = Math.max(c.depth, Math.min(0.7, (0.26 + speed * 0.012) * w));
      if (this.time - c.lastPress > 0.16) {
        c.velocity = Math.min(3.2, c.velocity + (0.95 + speed * 0.1) * w);
        c.depth = Math.min(0.7, c.depth + 0.13 * w);
        c.lastPress = this.time;
        c.memory = Math.min(1, c.memory + 0.3 * w);
        if (w > 0.25) {
          this.presses++;
          this.density.push({ x: c.x, y: c.y, time: this.time });
        }
      }
    }
    this.density = this.density.filter((p) => this.time - p.time < 1.8);
    if (this.density.length > 14) {
      const sum = this.density.reduce(
        (a, p) => ({ x: a.x + p.x, y: a.y + p.y }),
        { x: 0, y: 0 },
      );
      this.wave(sum.x / this.density.length, sum.y / this.density.length, 0.13);
      this.density = [];
    }
  }
  end(release = true) {
    if (this.active && release) {
      const strength = Math.min(0.16, 0.035 + this.held * 0.035);
      this.wave(this.x, this.y, strength);
      this.releaseEnergy = Math.min(1, 0.25 + this.held * 0.25);
    }
    this.active = false;
    this.held = 0;
    this.speed = 0;
  }
  wave(x: number, y: number, strength: number) {
    this.waves.push({ x, y, time: this.time, strength });
    if (this.waves.length > 4) this.waves.shift();
    this.waveCount++;
  }
  step(delta: number, reduced = false) {
    const duration = Math.min(0.05, delta),
      steps = Math.max(1, Math.ceil(duration * 120)),
      dt = duration / steps;
    for (let step = 0; step < steps; step++) {
      this.time += dt;
      if (this.active) this.held += dt;
      this.waves = this.waves.filter((w) => this.time - w.time < 2.6);
      const previous = this.cells.map((c) => c.depth);
      for (let i = 0; i < this.cells.length; i++) {
        const c = this.cells[i],
          d = Math.hypot(c.x - this.x, c.y - this.y);
        const influence = this.active
          ? Math.exp(((-d * d) / (c.radius * c.radius)) * 1.7)
          : 0;
        let target = influence * Math.min(0.76, 0.3 + this.held * 0.17);
        for (const w of this.waves) {
          const age = this.time - w.time,
            distance = Math.hypot(c.x - w.x, c.y - w.y);
          target +=
            Math.sin((distance - age * 3.5) * 5) *
            Math.exp(-Math.pow((distance - age * 3.5) * 1.8, 2)) *
            Math.exp(-age * 1.3) *
            w.strength *
            (reduced ? 0.3 : 1);
        }
        let coupling = 0;
        for (const j of this.neighbors[i])
          coupling += previous[j] - previous[i];
        c.velocity +=
          ((target - c.depth) * c.stiffness +
            coupling * 4 -
            c.velocity * (reduced ? 12 : c.damping)) *
          dt;
        c.depth = Math.max(-0.14, Math.min(0.79, c.depth + c.velocity * dt));
        c.bendX +=
          ((this.active ? (this.x - c.x) * Math.exp(-d * d * 0.7) * 0.085 : 0) -
            c.bendX) *
          (1 - Math.exp(-dt * 8));
        c.bendY +=
          ((this.active ? (this.y - c.y) * Math.exp(-d * d * 0.7) * 0.085 : 0) -
            c.bendY) *
          (1 - Math.exp(-dt * 8));
        c.memory *= Math.exp(-dt * 0.045);
      }
    }
  }
  reset() {
    this.end(false);
    this.waves = [];
    this.density = [];
    for (const c of this.cells) {
      c.depth = 0;
      c.velocity = 0;
      c.memory = 0;
      c.bendX = c.bendY = 0;
    }
  }
}
