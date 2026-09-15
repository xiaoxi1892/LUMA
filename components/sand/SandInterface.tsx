import type { SandTool } from "@/lib/sand/config";
import { ToolIcon } from "./ToolIcon";

interface Props {
  tool: SandTool;
  select: (tool: SandTool) => void;
  relevel: () => void;
  sound: boolean;
  loading: boolean;
  volume: number;
  toggleSound: () => void;
  setVolume: (v: number) => void;
  paused: boolean;
  togglePause: () => void;
  hint: boolean;
  message: string;
  breakRunning: boolean;
  progress: number;
  completed: boolean;
  toggleBreak: () => void;
}
export default function SandInterface(p: Props) {
  return (
    <>
      <header className="sand-header">
        <div className="sand-brand">
          <h1>LUMA</h1>
          <span>绒光沙盘</span>
        </div>
        <div className="sand-header-actions">
          <button
            className="quiet-button"
            onClick={p.relevel}
            disabled={p.paused}
          >
            重新铺平 <span aria-hidden>↺</span>
          </button>
          <button
            className="pause-button"
            aria-label={p.paused ? "继续沙盘" : "暂停沙盘"}
            aria-pressed={p.paused}
            onClick={p.togglePause}
            title="暂停 / 继续 · Esc"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              aria-hidden
            >
              {p.paused ? (
                <path d="m5 3 7 5-7 5Z" />
              ) : (
                <path d="M5 3v10M11 3v10" />
              )}
            </svg>
          </button>
        </div>
      </header>
      <div
        className={`sand-hint ${p.hint || p.completed || p.message || p.paused ? "is-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {p.paused
          ? "已暂停。痕迹还在，随时继续。"
          : p.message ||
            (p.completed ? "随时可以回去啦。" : "按住拖动，慢慢梳开。")}
      </div>
      <footer className="sand-footer">
        <div className="sand-sound">
          <button
            className="quiet-button sound-button"
            aria-label={p.sound ? "关闭声音" : "开启声音"}
            aria-pressed={p.sound}
            onClick={p.toggleSound}
            disabled={p.loading}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 20 20"
              stroke="currentColor"
              strokeWidth="1.1"
              fill="none"
              aria-hidden
            >
              <path d="M3 8h3l4-4v12l-4-4H3Z" />
              {p.sound ? (
                <path d="M13 7q3 3 0 6m2-9q6 6 0 12" />
              ) : (
                <path d="m14 8 4 4m0-4-4 4" />
              )}
            </svg>
            <span>
              {p.loading ? "载入声音" : p.sound ? "声音已开" : "声音已关"}
            </span>
          </button>
          <input
            aria-label="声音音量"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={p.volume}
            onChange={(e) => p.setVolume(Number(e.target.value))}
            title={`音量 ${Math.round(p.volume * 100)}%`}
          />
        </div>
        <div className="sand-tools" role="group" aria-label="沙盘工具">
          {(["comb", "gather", "smooth"] as const).map((t, i) => (
            <button
              key={t}
              aria-pressed={p.tool === t}
              onClick={() => p.select(t)}
            >
              <ToolIcon tool={t} />
              <span>{["梳开", "聚拢", "抚平"][i]}</span>
            </button>
          ))}
        </div>
        <button
          className="break-button quiet-button"
          onClick={p.toggleBreak}
          aria-label={p.breakRunning ? "结束两分钟休息计时" : "休息 2 分钟"}
        >
          <span>
            {p.breakRunning
              ? "慢慢来，随时离开"
              : p.completed
                ? "再休息 2 分钟"
                : "休息 2 分钟"}
          </span>
          {p.breakRunning ? (
            <span className="break-progress" aria-hidden>
              <i style={{ transform: `scaleX(${p.progress})` }} />
            </span>
          ) : (
            <span aria-hidden className="break-orbit">
              ◷
            </span>
          )}
        </button>
      </footer>
    </>
  );
}
