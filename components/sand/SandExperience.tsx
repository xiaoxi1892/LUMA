"use client";

import { publicAsset } from "@/lib/publicAsset";
import dynamic from "next/dynamic";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { SurfaceField } from "@/lib/sand/SurfaceField";
import { SAND, type SandTool } from "@/lib/sand/config";
import { BreakClock } from "@/lib/sand/BreakClock";
import { SandAudioEngine } from "@/audio/sand/SandAudioEngine";
import type { SandRuntime } from "./SandWorld";
import SandInterface from "./SandInterface";
import SandFallback from "./SandFallback";
const SandWorld = dynamic(() => import("./SandWorld"), { ssr: false });
const subscribe = () => () => {};

class SurfaceBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function SandExperience() {
  const [tool, setTool] = useState<SandTool>("comb"),
    [hint, setHint] = useState(true);
  const [paused, setPaused] = useState(false),
    [hidden, setHidden] = useState(false);
  const [sound, setSound] = useState(false),
    [loading, setLoading] = useState(false),
    [volume, setVolume] = useState(0.45);
  const [message, setMessage] = useState("");
  const [breakView, setBreakView] = useState({
    running: false,
    progress: 0,
    completed: false,
  });
  const [capture, setCapture] = useState<{
      audio: string;
      video: string;
    } | null>(null),
    [recording, setRecording] = useState(false);
  const inspect = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(location.search).has("inspect"),
    () => false,
  );
  const audio = useRef<SandAudioEngine | null>(null),
    root = useRef<HTMLDivElement>(null);
  const clock = useMemo(() => new BreakClock(), []);
  const runtime = useMemo<SandRuntime>(() => {
    const compact =
      typeof window !== "undefined" && matchMedia("(max-width:650px)").matches;
    const low =
      typeof window !== "undefined" &&
      ["low", "canvas"].includes(
        new URLSearchParams(location.search).get("quality") ?? "",
      );
    return {
      field: new SurfaceField(
        low
          ? SAND.lowResolution
          : compact
            ? SAND.compactResolution
            : SAND.resolution,
      ),
      paused: false,
      hidden: false,
      reduced: false,
      onStroke: () => setHint(false),
      onGesture: () => {
        void audio.current?.gesture();
      },
      onRelease: () => {
        audio.current?.release(runtime.field.tool);
      },
      onFrame: (speed, active) =>
        audio.current?.update(speed, active, runtime.field.tool),
    };
  }, []);
  useEffect(() => {
    const engine = new SandAudioEngine();
    audio.current = engine;
    try {
      const stored = localStorage.getItem("luma-sand-volume");
      if (stored !== null) {
        const v = Number(stored);
        if (Number.isFinite(v)) {
          engine.setVolume(v);
          queueMicrotask(() => setVolume(engine.volume));
        }
      }
    } catch {
      /* private browsing */
    }
    const media = matchMedia("(prefers-reduced-motion:reduce)");
    const reduce = () => {
      runtime.reduced =
        media.matches ||
        new URLSearchParams(location.search).get("motion") === "reduce";
    };
    reduce();
    media.addEventListener("change", reduce);
    let previous = performance.now();
    const visibility = () => {
      const now = performance.now();
      clock.step((now - previous) / 1000, runtime.paused || runtime.hidden);
      previous = now;
      runtime.hidden = document.hidden;
      setHidden(document.hidden);
      if (document.hidden) {
        runtime.field.end();
        engine.interrupt();
      }
    };
    const blur = () => {
      runtime.field.end();
      engine.interrupt();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        runtime.paused = !runtime.paused;
        runtime.field.end();
        engine.interrupt();
        setPaused(runtime.paused);
      }
    };
    window.addEventListener("keydown", key);
    const timer = setInterval(() => {
      const now = performance.now();
      clock.step((now - previous) / 1000, runtime.paused || runtime.hidden);
      previous = now;
      if (clock.running || clock.completed)
        setBreakView({
          running: clock.running,
          progress: clock.elapsed / 120,
          completed: clock.completed,
        });
    }, 250);
    return () => {
      clearInterval(timer);
      engine.dispose();
      if (audio.current === engine) audio.current = null;
      media.removeEventListener("change", reduce);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("keydown", key);
    };
  }, [runtime, clock]);
  useEffect(
    () => () => {
      if (capture) {
        URL.revokeObjectURL(capture.audio);
        URL.revokeObjectURL(capture.video);
      }
    },
    [capture],
  );
  function select(next: SandTool) {
    runtime.field.end();
    audio.current?.update(0, false, tool);
    runtime.field.tool = next;
    setTool(next);
  }
  function pause() {
    runtime.paused = !runtime.paused;
    runtime.field.end();
    audio.current?.interrupt();
    setPaused(runtime.paused);
  }
  async function toggleSound() {
    if (sound) {
      audio.current?.disable();
      setSound(false);
      return;
    }
    setLoading(true);
    const okay = await audio.current?.enable();
    setLoading(false);
    setSound(Boolean(okay));
    setMessage(okay ? "" : "声音暂时无法加载，沙盘仍可使用。");
  }
  function volumeChange(v: number) {
    setVolume(v);
    audio.current?.setVolume(v);
    try {
      localStorage.setItem("luma-sand-volume", String(v));
    } catch {
      /* preferences are optional */
    }
  }
  function toggleBreak() {
    if (clock.running) clock.stop();
    else clock.start();
    setBreakView({
      running: clock.running,
      progress: clock.elapsed / 120,
      completed: clock.completed,
    });
  }
  async function record() {
    const canvas = root.current?.querySelector("canvas");
    if (!canvas || !audio.current) return;
    setRecording(true);
    setCapture(null);
    try {
      const result = await audio.current.capture(canvas);
      setCapture({
        audio: URL.createObjectURL(result.audio),
        video: URL.createObjectURL(result.video),
      });
    } catch {
      setMessage("当前浏览器无法录制，可继续使用试听页。");
    }
    setRecording(false);
  }
  return (
    <main className="sand-experience">
      <div className="sand-canvas" ref={root}>
        <SurfaceBoundary
          fallback={
            <SandFallback runtime={runtime} running={!paused && !hidden} />
          }
        >
          <SandWorld runtime={runtime} running={!paused && !hidden} />
        </SurfaceBoundary>
      </div>
      <SandInterface
        tool={tool}
        select={select}
        relevel={() => runtime.field.relevel()}
        sound={sound}
        loading={loading}
        volume={volume}
        toggleSound={toggleSound}
        setVolume={volumeChange}
        paused={paused}
        togglePause={pause}
        hint={hint}
        message={message}
        breakRunning={breakView.running}
        progress={breakView.progress}
        completed={breakView.completed}
        toggleBreak={toggleBreak}
      />
      {inspect && (
        <aside className="sand-inspect">
          <a href={publicAsset("/audio-lab/")}>声音试听室</a>
          <button onClick={record} disabled={!sound || recording}>
            {recording ? "录制中 · 20 秒" : "录制 20 秒实测"}
          </button>
          <button
            onClick={() =>
              console.info(
                "[LUMA audio]",
                JSON.stringify(audio.current?.diagnostics()),
              )
            }
          >
            音频状态
          </button>
          {capture && (
            <>
              <a href={capture.audio} download="interaction-mix.webm">
                下载声音
              </a>
              <a href={capture.video} download="interaction-video.webm">
                下载实测视频
              </a>
            </>
          )}
        </aside>
      )}
    </main>
  );
}
