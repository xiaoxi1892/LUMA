import type { SandRuntime } from "../../components/sand/SandWorld";
import type { MaterialTransition } from "./MaterialTransition";
import type { BeadField } from "./BeadField";
import type { BubbleField } from "./BubbleField";
export type MaterialMode = "sand" | "bubble" | "beads";
export type MaterialSound = {
  kind: "press" | "release" | "collision";
  energy: number;
  count: number;
  speed: number;
};
export interface PlayRuntime {
  sand: SandRuntime;
  bubble: BubbleField;
  beads: BeadField;
  mode: MaterialMode;
  quality: number;
  paused: boolean;
  hidden: boolean;
  reduced: boolean;
  width: number;
  depth: number;
  transition: MaterialTransition;
  onTransitionEnd: () => void;
  onGesture: () => void;
  onStroke: () => void;
  onSound: (event: MaterialSound) => void;
}
export function worldDimensions(width: number, height: number) {
  const compact = width < 650,
    aspect = width / height,
    depth = compact ? 10.8 : 7.8;
  return {
    width: compact
      ? depth * aspect * 1.15
      : Math.min(15.5, depth * aspect * 1.02),
    depth,
    compact,
  };
}
