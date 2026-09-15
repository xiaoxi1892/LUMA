export type SandTool = "comb" | "gather" | "smooth";

/** All artistic / performance limits live here; units are tray-space metres. */
export const SAND = {
  resolution: 512,
  compactResolution: 256,
  lowResolution: 128,
  desktopGrains: 28000,
  compactGrains: 10000,
  movingGrains: 96,
  maxDpr: 1.75,
  compactDpr: 1.25,
  brushRadius: { comb: 0.48, gather: 0.68, smooth: 0.85 },
  toothSpacing: 0.16,
  maxHeight: 0.48,
  minHeight: -0.28,
  strokeSpacing: 0.065,
  resetSeconds: 1.05,
} as const;

export const clamp = (x: number, a: number, b: number) =>
  Math.min(b, Math.max(a, x));
export const ease = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
