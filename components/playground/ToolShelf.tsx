import { ToolIcon } from "@/components/sand/ToolIcon";
import type { SandTool } from "@/lib/sand/config";
import type { MaterialMode } from "@/lib/playground/types";
export default function ToolShelf({
  mode,
  tool,
  transitioning,
  select,
  skip,
  repel,
}: {
  mode: MaterialMode;
  tool: SandTool;
  transitioning: boolean;
  select: (tool: SandTool) => void;
  skip: () => void;
  repel: () => void;
}) {
  if (transitioning)
    return (
      <div className="sand-tools">
        <button className="skip-transition" onClick={skip}>
          跳过变化
        </button>
      </div>
    );
  return (
    <div className="sand-tools">
      {mode === "sand" ? (
        (["comb", "gather", "smooth"] as SandTool[]).map((t, i) => (
          <button key={t} aria-pressed={tool === t} onClick={() => select(t)}>
            <ToolIcon tool={t} />
            {["梳开", "聚拢", "抚平"][i]}
          </button>
        ))
      ) : mode === "bubble" ? (
        <span className="material-caption">SOFT CELLS</span>
      ) : (
        <button className="polarity-button" onClick={repel}>
          散开 <span aria-hidden="true">↔</span>
        </button>
      )}
    </div>
  );
}
