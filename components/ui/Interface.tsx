"use client";
import type { MatterMode } from "@/lib/matter/types";
export default function Interface({ mode, sound, onMode, onSound, onReset, hint }: {
  mode: MatterMode; sound: boolean; onMode: () => void; onSound: () => void; onReset: () => void; hint: string;
}) {
  const index = { MELT: "01", PULSE: "02", FIELD: "03" }[mode];
  return <>
    <header className="interface">
      <div className="brand"><h1>LUMA</h1><span>TACTILE MATTER</span></div>
      <button className="state-control" onClick={onMode} aria-label={`Change matter state. Current ${mode}`} title="Change matter state">
        <span className="state-index">{index}</span><span className="state-dash">—</span><span className="state-name">{mode}</span>
        <span className="state-orbit" aria-hidden="true"><i /><i /><i /></span>
      </button>
      <div className="utility-controls">
        <button onClick={onSound} aria-pressed={sound} aria-label={sound ? "Mute sound" : "Enable sound"}><span className={`sound-mark ${sound ? "on" : ""}`} aria-hidden="true"><i /><i /><i /></span>SOUND</button>
        <button onClick={onReset}>RESET</button>
      </div>
    </header>
    <div className={`discovery ${hint ? "visible" : ""}`} aria-live="polite"><span key={hint}>{hint}</span></div>
  </>;
}
