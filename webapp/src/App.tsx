import { useEffect } from "react";
import DiffDrawer from "./components/DiffDrawer";
import FilterBar from "./components/FilterBar";
import ResourceTable from "./components/ResourceTable";
import { useStore } from "./store";

export default function App() {
  const load = useStore((s) => s.load);
  const selected = useStore((s) => s.selected);
  const clearSelection = useStore((s) => s.clearSelection);
  const status = useStore((s) => s.status);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Skill Manager</h1>
          <span className="text-xs text-zinc-500 font-mono">v0.4</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-500">
            {status === "ready" ? "connected" : status}
          </span>
          {selected.size > 0 && (
            <>
              <span className="text-zinc-400">
                {selected.size} selected
              </span>
              <button
                type="button"
                className="text-zinc-500 hover:text-zinc-200 underline"
                onClick={clearSelection}
              >
                clear
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => load()}
            disabled={status === "loading"}
            className="px-2 py-1 rounded border border-zinc-700 hover:border-zinc-500 disabled:opacity-50"
          >
            refresh
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 max-w-7xl mx-auto w-full">
        <FilterBar />
        <ResourceTable />
      </main>

      <footer className="border-t border-zinc-800 px-6 py-3 text-xs text-zinc-500">
        Local-only • No telemetry • <span className="font-mono">/api/v2</span>
      </footer>

      <DiffDrawer />
    </div>
  );
}
