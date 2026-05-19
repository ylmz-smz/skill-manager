import { create } from "zustand";
import { listResources } from "./api/client";
import type { Resource } from "./api/types";
import type { ResourceKind, ToolId } from "@domain/types.js";

/**
 * Single Zustand store for the v0.4 UI.
 *
 * Why one store instead of several:
 * - The resource list, filter widgets, selection and the diff drawer
 *   all share state (e.g. "apply needs the selected resource ids").
 * - Splitting too early couples nothing useful and forces awkward
 *   cross-store derivations.
 *
 * We'll re-split when (and only when) profiling shows re-render storms.
 */

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export function resourceKey(r: Resource): string {
  return `${r.kind}:${r.tool}:${r.id}`;
}

interface State {
  // --- catalog ---
  status: LoadStatus;
  error: string | undefined;
  resources: Resource[];

  // --- filters ---
  kindFilter: ReadonlySet<ResourceKind>;
  toolFilter: ReadonlySet<ToolId>;
  search: string;

  // --- selection ---
  selected: ReadonlySet<string>;

  // --- actions ---
  load: () => Promise<void>;
  toggleSelect: (key: string) => void;
  clearSelection: () => void;
  setKindFilter: (k: ReadonlySet<ResourceKind>) => void;
  setToolFilter: (t: ReadonlySet<ToolId>) => void;
  setSearch: (s: string) => void;
}

const ALL_KINDS: ReadonlySet<ResourceKind> = new Set([
  "skill",
  "subagent",
  "mcp_server",
]);

export const useStore = create<State>((set, get) => ({
  status: "idle",
  error: undefined,
  resources: [],
  kindFilter: ALL_KINDS,
  toolFilter: new Set<ToolId>(),
  search: "",
  selected: new Set<string>(),

  async load() {
    set({ status: "loading", error: undefined });
    try {
      const resources = await listResources();
      set({ resources, status: "ready" });
    } catch (e) {
      set({
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  toggleSelect(key) {
    const next = new Set(get().selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    set({ selected: next });
  },

  clearSelection() {
    set({ selected: new Set() });
  },

  setKindFilter(k) {
    set({ kindFilter: k });
  },

  setToolFilter(t) {
    set({ toolFilter: t });
  },

  setSearch(s) {
    set({ search: s });
  },
}));

/**
 * Pure filter helper — kept outside the store so it can be re-used
 * for tests and any future derived selectors.
 */
export function filterResources(
  rows: readonly Resource[],
  kindFilter: ReadonlySet<ResourceKind>,
  toolFilter: ReadonlySet<ToolId>,
  search: string,
): Resource[] {
  const q = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (!kindFilter.has(r.kind)) return false;
    if (toolFilter.size > 0 && !toolFilter.has(r.tool as ToolId)) return false;
    if (q) {
      const id = r.id.toLowerCase();
      const display = r.displayName.toLowerCase();
      if (!id.includes(q) && !display.includes(q)) return false;
    }
    return true;
  });
}
