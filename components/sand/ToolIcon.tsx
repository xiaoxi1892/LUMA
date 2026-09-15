import type { SandTool } from "@/lib/sand/config";
export function ToolIcon({ tool }: { tool: SandTool }) {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {tool === "comb" ? (
        <path d="M5 5v14M9.7 5v14M14.3 5v14M19 5v14" />
      ) : tool === "gather" ? (
        <path d="M19 15a8 8 0 1 0-7 5c3 0 6-2 6-5a6 6 0 1 0-6 3 4 4 0 1 0-4-4" />
      ) : (
        <path d="M4 8c4-3 12 3 16 0M4 12c4-3 12 3 16 0M4 16c4-3 12 3 16 0" />
      )}
    </svg>
  );
}
