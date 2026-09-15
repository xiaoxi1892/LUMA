"use client";

import { publicAsset } from "@/lib/publicAsset";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SurfaceField } from "@/lib/sand/SurfaceField";
import { BreakClock } from "@/lib/sand/BreakClock";
import { MaterialTransition } from "@/lib/playground/MaterialTransition";
import { BeadField } from "@/lib/playground/BeadField";
import { BubbleField } from "@/lib/playground/BubbleField";
import { TactileAudioEngine } from "@/audio/playground/TactileAudioEngine";
import type { PlayRuntime, MaterialMode } from "@/lib/playground/types";
import type { SandTool } from "@/lib/sand/config";
import InspectTools from "./InspectTools";
import ToolShelf from "./ToolShelf";
const PlayWorld = dynamic(() => import("./PlayWorld"), { ssr: false });
const labels = {
  sand: "梳过这里，留下一点秩序。",
  bubble: "按下，或慢慢划过。",
  beads: "聚在掌心，再轻轻松开。",
};
export default function BreakSpace() {
  const [transitioning, setTransitioning] = useState(false);
  const [mode, setMode] = useState<MaterialMode>("sand"),
    [tool, setTool] = useState<SandTool>("comb");
  const [paused, setPaused] = useState(false),
    [hidden, setHidden] = useState(false),
    [sound, setSound] = useState(false),
    [loading, setLoading] = useState(false),
    [volume, setVolume] = useState(0.45),
    [menu, setMenu] = useState(false),
    [hint, setHint] = useState(true),
    [message, setMessage] = useState("");
  const [breakView, setBreakView] = useState({
    running: false,
    progress: 0,
    completed: false,
  });
  const audio = useRef<TactileAudioEngine | null>(null),
    clock = useMemo(() => new BreakClock(), []);
  const runtime = useMemo<PlayRuntime>(() => {
    const compact =
      typeof window !== "undefined" && matchMedia("(max-width:650px)").matches;
    const r: PlayRuntime = {
      mode: "sand",
      quality: 0,
      paused: false,
      hidden: false,
      reduced: false,
      width: 12,
      depth: 7.8,
      bubble: new BubbleField(),
      beads: new BeadField(compact ? 168 : 264),
      transition: new MaterialTransition(),
      onTransitionEnd: () => {
        setTransitioning(false);
      },
      sand: {
        field: new SurfaceField(compact ? 256 : 512),
        paused: false,
        hidden: false,
        reduced: false,
        onStroke: () => setHint(false),
        onGesture: () => {
          void audio.current?.gesture();
        },
        onRelease: () => audio.current?.release(r.sand.field.tool),
        onFrame: (speed, active) =>
          audio.current?.update(speed, active, r.sand.field.tool),
      },
      onStroke: () => setHint(false),
      onGesture: () => {
        void audio.current?.gesture();
      },
      onSound: (event) => audio.current?.event(event),
    };
    return r;
  }, []);
  const changeMode = useCallback(
    (next: MaterialMode) => {
      if (next === runtime.mode || runtime.transition.active) return;
      runtime.sand.field.end();
      runtime.bubble.end(false);
      runtime.beads.end(false);
      audio.current?.update(0, false, runtime.sand.field.tool);
      audio.current?.select(next);
      runtime.transition.start(runtime.mode, next, runtime.reduced);
      runtime.mode = next;
      setMode(next);
      setTransitioning(true);
      setHint(true);
      setMenu(false);
    },
    [runtime],
  );
  const pause = useCallback(() => {
    runtime.paused = !runtime.paused;
    runtime.sand.paused = runtime.paused;
    runtime.sand.field.end();
    runtime.bubble.end(false);
    runtime.beads.end(false);
    audio.current?.interrupt();
    setPaused(runtime.paused);
  }, [runtime]);
  useEffect(() => {
    const engine = new TactileAudioEngine();
    audio.current = engine;
    engine.select(runtime.mode);
    try {
      const stored = localStorage.getItem("luma-sand-volume");
      if (stored !== null && Number.isFinite(Number(stored))) {
        engine.setVolume(Number(stored));
        queueMicrotask(() => setVolume(engine.volume));
      }
    } catch {
      /* optional preference */
    }
    const media = matchMedia("(prefers-reduced-motion: reduce)"),
      reduce = () => {
        runtime.reduced =
          media.matches ||
          new URLSearchParams(location.search).get("motion") === "reduce";
        runtime.sand.reduced = runtime.reduced;
      };
    reduce();
    media.addEventListener("change", reduce);
    let previous = performance.now();
    const tick = () => {
      const now = performance.now();
      clock.step((now - previous) / 1000, runtime.paused || runtime.hidden);
      previous = now;
      setBreakView({
        running: clock.running,
        progress: clock.elapsed / 120,
        completed: clock.completed,
      });
    };
    const visibility = () => {
      tick();
      runtime.hidden = document.hidden;
      runtime.sand.hidden = document.hidden;
      setHidden(document.hidden);
      if (document.hidden) {
        runtime.sand.field.end();
        runtime.bubble.end(false);
        runtime.beads.end(false);
        engine.interrupt();
      }
    };
    const blur = () => {
      runtime.sand.field.end();
      runtime.bubble.end(false);
      runtime.beads.end(false);
      engine.interrupt();
    };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "Escape") {
        setMenu(false);
        pause();
      }
      if (e.key === "1") changeMode("sand");
      if (e.key === "2") changeMode("bubble");
      if (e.key === "3") changeMode("beads");
    };
    const timer = setInterval(tick, 250);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("keydown", key);
    return () => {
      clearInterval(timer);
      engine.dispose();
      audio.current = null;
      media.removeEventListener("change", reduce);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("keydown", key);
    };
  }, [runtime, clock, changeMode, pause]);
  async function toggleSound() {
    if (sound) {
      audio.current?.disable();
      setSound(false);
      return;
    }
    setLoading(true);
    const ok = await audio.current?.enable();
    setLoading(false);
    setSound(Boolean(ok));
    setMessage(ok ? "" : "声音暂时无法加载，仍可继续使用。");
  }
  function reset(all = false) {
    if (runtime.transition.active) {
      runtime.transition.skip();
      setTransitioning(false);
    }
    if (all || mode === "sand") runtime.sand.field.relevel();
    if (all || mode === "bubble") runtime.bubble.reset();
    if (all || mode === "beads") runtime.beads.reset();
    setMenu(false);
  }
  function select(t: SandTool) {
    runtime.sand.field.end();
    runtime.sand.field.tool = t;
    setTool(t);
  }
  return (
    <main className="sand-experience break-space" data-mode={mode}>
      <div className="sand-canvas">
        <PlayWorld
          runtime={runtime}
          mode={transitioning ? "transition" : mode}
          running={!paused && !hidden}
        />
      </div>
      <header className="break-header">
        <div className="break-brand">
          <h1>LUMA</h1>
          <span>TACTILE BREAK SPACE</span>
        </div>
        <nav className="material-nav" aria-label="材质">
          <button
            aria-pressed={mode === "sand"}
            onClick={() => changeMode("sand")}
          >
            SAND
          </button>
          <button
            aria-pressed={mode === "bubble"}
            onClick={() => changeMode("bubble")}
          >
            BUBBLE
          </button>
          <button
            aria-pressed={mode === "beads"}
            onClick={() => changeMode("beads")}
          >
            BEADS
          </button>
        </nav>
        <div className="break-actions">
          <button className="quiet-button" onClick={() => reset()}>
            重置
          </button>
          <button
            className="quiet-button more-button"
            aria-label="更多选项"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            ···
          </button>
        </div>
        {menu && (
          <div className="break-menu">
            <button onClick={pause}>
              {paused ? "继续" : "暂停"} <span>Esc</span>
            </button>
            <button onClick={() => reset(true)}>重置全部材质</button>
            <a href={publicAsset("/audio-lab/")}>声音来源与试听</a>
          </div>
        )}
      </header>
      <div
        className={`sand-hint ${hint || message || paused || breakView.completed ? "is-visible" : ""}`}
        aria-live="polite"
      >
        {message ||
          (paused
            ? "已暂停，随时继续。"
            : breakView.completed
              ? "随时可以回去啦。"
              : labels[mode])}
      </div>
      <footer className="sand-footer">
        <div className="sand-sound">
          <button
            className="quiet-button sound-button"
            aria-pressed={sound}
            disabled={loading}
            onClick={toggleSound}
          >
            {loading ? "加载中" : sound ? "声音开" : "声音关"}{" "}
            <span aria-hidden="true">{sound ? "◖" : "◌"}</span>
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step=".01"
            value={volume}
            aria-label="音量"
            onChange={(e) => {
              const v = +e.target.value;
              setVolume(v);
              audio.current?.setVolume(v);
              try {
                localStorage.setItem("luma-sand-volume", String(v));
              } catch {
                /* optional preference */
              }
            }}
          />
        </div>
        <ToolShelf
          mode={mode}
          tool={tool}
          transitioning={transitioning}
          select={select}
          skip={() => {
            runtime.transition.skip();
            setTransitioning(false);
          }}
          repel={() => {
            runtime.beads.repel();
            runtime.onGesture();
          }}
        />
        <button
          className="quiet-button break-button"
          onClick={() => {
            if (clock.running) clock.stop();
            else clock.start();
            setBreakView({
              running: clock.running,
              progress: clock.elapsed / 120,
              completed: clock.completed,
            });
          }}
          aria-label={breakView.running ? "结束这次休息" : "开始两分钟休息"}
        >
          <span>
            {breakView.running
              ? "留一点时间"
              : breakView.completed
                ? "再歇一会儿"
                : "歇两分钟"}
          </span>
          <span className="break-progress">
            <i style={{ transform: `scaleX(${breakView.progress})` }} />
          </span>
        </button>
      </footer>
      <InspectTools engine={() => audio.current} sound={sound} />
    </main>
  );
}
