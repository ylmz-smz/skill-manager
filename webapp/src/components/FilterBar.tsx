import { useStore } from "../store";
import type { ResourceKind, ToolId } from "@domain/types.js";

/**
 * Filter bar above the resource table.
 *
 * Three controls:
 *  1. Search (substring match on id + displayName).
 *  2. Kind toggles (skill / subagent / mcp_server) — at least one must
 *     stay on; clicking the last on does nothing.
 *  3. Tool toggles — empty set means "all tools" so an empty filter
 *     does not hide the catalog.
 */

const KIND_LABELS: Record<ResourceKind, string> = {
  skill: "Skills",
  subagent: "Subagents",
  mcp_server: "MCP",
};

const TOOLS: ToolId[] = [
  "cursor",
  "claude-code",
  "codex",
  "agents",
  "vscode",
  "codebuddy",
];

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

function Chip({ active, onClick, children, disabled }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "px-2 py-1 text-xs rounded border transition-colors " +
        (active
          ? "bg-sky-500/15 border-sky-500/40 text-sky-200"
          : "bg-zinc-900/60 border-zinc-700 text-zinc-400 hover:text-zinc-100") +
        (disabled ? " opacity-50 cursor-not-allowed" : " cursor-pointer")
      }
    >
      {children}
    </button>
  );
}

export default function FilterBar() {
  const search = useStore((s) => s.search);
  const kindFilter = useStore((s) => s.kindFilter);
  const toolFilter = useStore((s) => s.toolFilter);
  const setSearch = useStore((s) => s.setSearch);
  const setKindFilter = useStore((s) => s.setKindFilter);
  const setToolFilter = useStore((s) => s.setToolFilter);

  const toggleKind = (k: ResourceKind) => {
    const next = new Set(kindFilter);
    if (next.has(k) && next.size === 1) return; // refuse last-off
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setKindFilter(next);
  };

  const toggleTool = (t: ToolId) => {
    const next = new Set(toolFilter);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setToolFilter(next);
  };

  return (
    <div className="flex flex-col gap-3 mb-4">
      <input
        type="text"
        placeholder="Search by id or name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded
                   focus:outline-none focus:border-sky-500 placeholder:text-zinc-600"
      />
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 mr-1">Kind</span>
        {(Object.keys(KIND_LABELS) as ResourceKind[]).map((k) => (
          <Chip key={k} active={kindFilter.has(k)} onClick={() => toggleKind(k)}>
            {KIND_LABELS[k]}
          </Chip>
        ))}
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 ml-4 mr-1">Tool</span>
        {TOOLS.map((t) => (
          <Chip key={t} active={toolFilter.has(t)} onClick={() => toggleTool(t)}>
            {t}
          </Chip>
        ))}
        {toolFilter.size > 0 && (
          <button
            type="button"
            className="ml-2 text-xs text-zinc-500 hover:text-zinc-200 underline"
            onClick={() => setToolFilter(new Set())}
          >
            clear tools
          </button>
        )}
      </div>
    </div>
  );
}
