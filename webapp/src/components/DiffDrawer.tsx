import { useStore } from "../store";
import type { ResourceOp, Strategy } from "../api/types";

/**
 * Right-side drawer that shows a redacted DiffPreview for the currently
 * targeted resource. Users can:
 *   - Flip op (enable / disable)         -> refetches preview
 *   - Pick strategy (auto / native / …)  -> refetches preview
 *   - Apply                              -> runs /api/v2/resources/apply
 *
 * Empty target -> drawer is hidden entirely.
 *
 * Apply state machine lives in the store (applyStatus: idle | applying
 * | done | error) so the button label and disabled state derive from
 * a single source of truth.
 */

function classifyLine(line: string): string {
  if (line.startsWith("--- ") || line.startsWith("+++ ")) return "text-sky-300";
  if (line.startsWith("@@")) return "text-fuchsia-300";
  if (line.startsWith("+")) return "text-emerald-300";
  if (line.startsWith("-")) return "text-rose-300";
  return "text-zinc-400";
}

function DiffView({ unified }: { unified: string }) {
  if (!unified) {
    return (
      <div className="text-zinc-500 italic text-sm py-6 text-center">
        No file changes — this op is a no-op.
      </div>
    );
  }
  const lines = unified.split("\n");
  return (
    <pre className="font-mono text-xs leading-5 overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-3">
      {lines.map((line, i) => (
        <div key={i} className={classifyLine(line)}>
          {line || "\u00A0"}
        </div>
      ))}
    </pre>
  );
}

const OPS: ResourceOp[] = ["disable", "enable"];
const STRATEGIES: Strategy[] = ["auto", "native", "managed", "symlink"];

export default function DiffDrawer() {
  const drawer = useStore((s) => s.drawer);
  const closeDrawer = useStore((s) => s.closeDrawer);
  const setDrawerOp = useStore((s) => s.setDrawerOp);
  const setDrawerStrategy = useStore((s) => s.setDrawerStrategy);
  const applyChange = useStore((s) => s.applyChange);

  if (!drawer.target) return null;

  const {
    target,
    op,
    strategy,
    preview,
    previewLoading,
    previewError,
    applyStatus,
    applyError,
    applyResult,
  } = drawer;

  return (
    <aside
      role="dialog"
      aria-label={`Preview ${op} for ${target.id}`}
      className="fixed inset-y-0 right-0 w-full sm:w-[640px] max-w-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col"
    >
      <header className="border-b border-zinc-800 px-5 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">
            {target.kind} · {target.tool}
          </div>
          <div className="text-sm font-medium truncate">{target.displayName}</div>
          <div className="text-xs text-zinc-500 font-mono truncate">{target.id}</div>
        </div>
        <button
          type="button"
          aria-label="Close drawer"
          onClick={closeDrawer}
          className="text-zinc-500 hover:text-zinc-200 text-lg leading-none px-2"
        >
          ×
        </button>
      </header>

      <div className="px-5 py-3 border-b border-zinc-800 flex flex-wrap gap-3 items-center text-xs">
        <span className="text-zinc-500 uppercase tracking-wider">Op</span>
        {OPS.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setDrawerOp(o)}
            disabled={previewLoading}
            className={
              "px-2 py-1 rounded border transition-colors " +
              (op === o
                ? "bg-sky-500/15 border-sky-500/40 text-sky-200"
                : "bg-zinc-900/60 border-zinc-700 text-zinc-400 hover:text-zinc-100")
            }
          >
            {o}
          </button>
        ))}
        <span className="text-zinc-500 uppercase tracking-wider ml-3">Strategy</span>
        {STRATEGIES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setDrawerStrategy(st)}
            disabled={previewLoading}
            className={
              "px-2 py-1 rounded border transition-colors " +
              (strategy === st
                ? "bg-violet-500/15 border-violet-500/40 text-violet-200"
                : "bg-zinc-900/60 border-zinc-700 text-zinc-400 hover:text-zinc-100")
            }
          >
            {st}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {previewLoading && (
          <div className="text-zinc-500 text-sm">Computing preview…</div>
        )}
        {previewError && (
          <div className="rounded border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300">
            Preview failed: {previewError}
          </div>
        )}
        {preview && !previewLoading && (
          <>
            <DiffView unified={preview.unifiedDiff} />
            {preview.redactedEnvKeys.length > 0 && (
              <div className="text-xs">
                <span className="text-yellow-400">redacted:</span>{" "}
                <span className="font-mono text-yellow-200">
                  {preview.redactedEnvKeys.join(", ")}
                </span>
              </div>
            )}
            {preview.warnings.length > 0 && (
              <ul className="text-xs space-y-1">
                {preview.warnings.map((w, i) => (
                  <li key={i} className="text-amber-300">
                    ! {w}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <footer className="border-t border-zinc-800 px-5 py-3 flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-500 min-w-0 truncate">
          {applyStatus === "applying" && "Applying…"}
          {applyStatus === "done" && applyResult?.applied &&
            `Applied — wrote ${applyResult.writtenPaths.length} path(s).`}
          {applyStatus === "error" && (
            <span className="text-red-300">Apply failed: {applyError}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={closeDrawer}
            className="px-3 py-1.5 text-sm rounded border border-zinc-700 hover:border-zinc-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => applyChange()}
            disabled={previewLoading || applyStatus === "applying" || !!previewError}
            className="px-3 py-1.5 text-sm rounded bg-sky-500/90 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
          >
            {applyStatus === "applying" ? "Applying…" : op === "enable" ? "Enable" : "Disable"}
          </button>
        </div>
      </footer>
    </aside>
  );
}
