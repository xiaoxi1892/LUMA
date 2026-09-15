"use client";
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createMatterWorld, resetMatter, type MatterMode } from "@/lib/matter/types";
import { changeMatterMode } from "@/lib/matter/actions";
import { AudioEngine } from "@/audio/AudioEngine";
import { useDiscovery } from "@/hooks/useDiscovery";
import Interface from "../ui/Interface";
import CustomCursor from "../ui/CustomCursor";
const World = dynamic(() => import("./World"), { ssr: false });
class WorldBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="world-fallback"><p>The matter is resting.</p><span>LUMA needs a browser with WebGL graphics enabled.</span><button onClick={() => location.reload()}>Try again</button></div> : this.props.children;
  }
}
export default function LumaExperience() {
  const world = useMemo(() => createMatterWorld(), []);
  const audio = useMemo(() => new AudioEngine(), []);
  const { hint, discover } = useDiscovery();
  const [mode, setMode] = useState<MatterMode>("MELT");
  const [sound, setSound] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => setError(true), []);
  useEffect(() => {
    world.onDiscover = discover;
    world.onSound = (event, intensity) => audio.play(event, intensity);
    return () => { world.onDiscover = () => {}; world.onSound = () => {}; audio.dispose(); };
  }, [audio, discover, world]);
  const changeMode = () => {
    const modes: MatterMode[] = ["MELT", "PULSE", "FIELD"];
    const next = modes[(modes.indexOf(mode) + 1) % modes.length];
    changeMatterMode(world, next); setMode(next); void audio.wake();
  };
  const toggleSound = () => { audio.setEnabled(!sound); setSound(!sound); };
  const reset = () => { resetMatter(world); world.mode = mode; };
  return <main className={`luma-playground ${ready ? "is-ready" : ""}`} data-mode={mode}>
    <div className="matter-surface" tabIndex={0} role="application" aria-label="LUMA tactile matter playground" aria-describedby="matter-help" data-pointer="idle">
      <WorldBoundary><World world={world} audio={audio} onReady={onReady} onError={onError} /></WorldBoundary>
    </div>
    <Interface mode={mode} sound={sound} onMode={changeMode} onSound={toggleSound} onReset={reset} hint={hint} />
    {!ready && <span className="formation-dot" aria-hidden="true" />}
    {error && <div className="world-fallback"><p>The canvas is resting.</p><button onClick={() => location.reload()}>Wake it up</button></div>}
    <CustomCursor />
    <p className="sr-only" id="matter-help">Pull matter apart, throw droplets and bring them together. Hold to charge. Double tap to split. Keyboard: hold Space or Enter and use arrows to pull; release to throw. D splits, Escape releases. Use the matter state control to change between Melt, Pulse and Field.</p>
    <noscript><div className="world-fallback">Enable JavaScript to play with LUMA.</div></noscript>
  </main>;
}
