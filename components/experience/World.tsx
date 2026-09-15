"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping, PerspectiveCamera, Vector3 } from "three";
import type { MatterWorld } from "@/lib/matter/types";
import { finishFormation } from "@/lib/matter/types";
import { stepMatter } from "@/lib/matter/physics";
import { useMatterPointer } from "@/hooks/useMatterPointer";
import { useAdaptiveQuality } from "@/hooks/useAdaptiveQuality";
import type { AudioEngine } from "@/audio/AudioEngine";
import MeltMatter from "../matter/MeltMatter";
import ParticleField from "../particles/ParticleField";

function MatterController({ world, audio, onReady, onError, compact }: WorldProps & { compact: boolean }) {
  const { camera, size, gl } = useThree();
  const quality = useAdaptiveQuality(compact);
  const ready = useRef(false);
  const look = useMemo(() => new Vector3(), []);
  const wake = useMemo(() => () => { void audio.wake(); }, [audio]);
  useMatterPointer(world, wake);
  useEffect(() => {
    const aspect = size.width / size.height;
    camera.position.z = aspect < 0.8 ? 4.4 / aspect : 7.3;
    camera.updateMatrixWorld();
  }, [camera, size]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { world.reducedMotion = media.matches; if (media.matches && world.intro < 1.6) finishFormation(world); };
    update(); media.addEventListener("change", update);
    const lost = (event: Event) => { event.preventDefault(); onError(); };
    const silence = () => { if (document.hidden) audio.update(0, 0, 0, 0); };
    document.addEventListener("visibilitychange", silence);
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => { media.removeEventListener("change", update); gl.domElement.removeEventListener("webglcontextlost", lost); document.removeEventListener("visibilitychange", silence); };
  }, [audio, gl, onError, world]);
  useFrame((_, delta) => {
    if (document.hidden) return;
    if (camera instanceof PerspectiveCamera) {
      const aspect = size.width / size.height;
      const z = aspect < 0.8 ? 4.4 / aspect : 7.3;
      const parallax = world.reducedMotion ? 0 : 0.09;
      camera.position.lerp(look.set(world.pointerNdc.x * parallax, world.pointerNdc.y * parallax, z), 1 - Math.exp(-3 * delta));
      camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
      const height = 2 * z * Math.tan(camera.fov * Math.PI / 360);
      world.bounds.set(height * aspect / 2, height / 2);
    }
    stepMatter(world, delta);
    world.pointerVelocity.multiplyScalar(Math.exp(-3 * Math.min(delta, 0.05)));
    audio.update(world.pointerVelocity.length(), world.grip?.distance ?? 0, world.charge, world.fieldMix);
    if (!ready.current) { ready.current = true; onReady(); }
  }, -10);
  return <><MeltMatter world={world} steps={quality.steps} /><ParticleField world={world} count={quality.particles} /></>;
}

interface WorldProps { world: MatterWorld; audio: AudioEngine; onReady: () => void; onError: () => void }
export default function World(props: WorldProps) {
  const compact = useMemo(() => matchMedia("(pointer: coarse), (max-width: 640px)").matches, []);
  return <Canvas camera={{ position: [0, 0, 7.3], fov: 38, near: 0.1, far: 40 }}
    dpr={[1, compact ? 1.25 : 1.75]} gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
    onCreated={({ gl }) => { gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.12; }}
    fallback={<span>Interactive digital matter. A browser with WebGL is required.</span>}>
    <MatterController {...props} compact={compact} />
  </Canvas>;
}
