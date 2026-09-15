"use client";

import { publicAsset } from "@/lib/publicAsset";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { TactileAudioEngine } from "@/audio/playground/TactileAudioEngine";
const subscribe = () => () => {};
export default function InspectTools({
  engine,
  sound,
}: {
  engine: () => TactileAudioEngine | null;
  sound: boolean;
}) {
  const inspect = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(location.search).has("inspect"),
    () => false,
  );
  const [recording, setRecording] = useState(false),
    [capture, setCapture] = useState<{ audio: string; video: string } | null>(
      null,
    ),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (capture) {
        URL.revokeObjectURL(capture.audio);
        URL.revokeObjectURL(capture.video);
      }
    },
    [capture],
  );
  async function record() {
    const canvas = document.querySelector("canvas"),
      audio = engine();
    if (!canvas || !audio) return;
    setRecording(true);
    setCapture(null);
    try {
      const result = await audio.capture(canvas);
      setCapture({
        audio: URL.createObjectURL(result.audio),
        video: URL.createObjectURL(result.video),
      });
    } catch {
      setError("当前浏览器无法录制。");
    }
    setRecording(false);
  }
  if (!inspect) return null;
  return (
    <aside className="sand-inspect">
      <a href={publicAsset("/audio-lab/")}>声音试听室</a>
      <button onClick={record} disabled={!sound || recording}>
        {recording ? "录制中 · 20 秒" : "录制 20 秒实测"}
      </button>
      <button
        onClick={() =>
          console.info("[LUMA audio]", JSON.stringify(engine()?.diagnostics()))
        }
      >
        音频状态
      </button>
      {capture && (
        <>
          <a href={capture.audio} download="materials-mix.webm">
            下载声音
          </a>
          <a href={capture.video} download="materials-video.webm">
            下载实测视频
          </a>
        </>
      )}
      {error}
    </aside>
  );
}
