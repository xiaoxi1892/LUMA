"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useState, type ReactNode } from "react";
import type { InteractionPhase } from "@/hooks/useBlobInteraction";

const Scene = dynamic(() => import("./Scene"), { ssr: false });

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="fallback">The sculpture couldn’t wake up.<br /><button onClick={() => window.location.reload()}>Try again</button></div>;
    return this.props.children;
  }
}

const hints: Record<InteractionPhase, string> = {
  idle: "drag · squeeze · release",
  near: "a little closer",
  holding: "hold a little. let it soften.",
  stretching: "follow the feeling",
  settling: "and let go.",
};

export default function BlobExperience() {
  const [phase, setPhase] = useState<InteractionPhase>("idle");
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => setLost(true), []);

  return (
    <main className={`experience ${ready ? "is-ready" : ""}`} data-phase={phase}>
      <div className="ambient-space" aria-hidden="true" />
      <header className="masthead">
        <h1 className="wordmark" aria-label="LUMA">LUMA</h1>
        <div className="edition"><span className="edition-symbol" aria-hidden="true">◌</span><span>soft matter</span></div>
      </header>
      <div className="ground-shadow" aria-hidden="true" />
      <div className="interaction-surface" tabIndex={0} role="application" aria-label="LUMA interactive soft sculpture" aria-describedby="keyboard-help" aria-keyshortcuts="Space Enter ArrowUp ArrowDown ArrowLeft ArrowRight Escape">
        <SceneBoundary><Scene onPhase={setPhase} onReady={onReady} onError={onError} /></SceneBoundary>
      </div>
      {!ready && <div className="loading-note" role="status">a moment of stillness<span>…</span></div>}
      {lost && <div className="fallback">The canvas is resting.<br /><button onClick={() => window.location.reload()}>Wake it up</button></div>}
      <footer className="experience-footer">
        <div className="footer-note">a moment, in your hands.</div>
        <div className="interaction-hint" key={phase}>{hints[phase]}</div>
        <div className="material-index" aria-label="Material study number one">I — 001</div>
      </footer>
      <p id="keyboard-help" className="sr-only">Click or touch the sculpture to squeeze. Hold and drag to stretch, then release. Keyboard: focus the canvas, hold Space or Enter, use arrow keys to stretch, and release to let go. Escape cancels.</p>
      <noscript><div className="fallback">Please enable JavaScript to touch LUMA.</div></noscript>
      <div className="film-grain" aria-hidden="true" />
    </main>
  );
}
