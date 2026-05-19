import { create } from "zustand";
import { applyResource, listResources, previewResource } from "./api/client";
import type {
  DiffPreview,
  MutationResult,
  Resource,
  ResourceOp,
  Strategy,
} from "./api/types";
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
export type ApplyStatus = "idle" | "applying" | "done" | "error";

export function resourceKey(r: Resource): string {
  return `${r.kind}:${r.tool}:${r.id}`;
}

export interface DrawerSlice {
  target: Resource | null;
  op: ResourceOp;
  strategy: Strategy;
  /** Most-recent successful preview; null while loading or after an error. */
  preview: DiffPreview | null;
  /** True while a /preview request is in flight. */
  previewLoading: boolean;
  previewError: string | undefined;
  applyStatus: ApplyStatus;
  applyResult: MutationResult | null;
  applyError: string | undefined;
}

const EMPTY_DRAWER: DrawerSlice = {
  target: null,
  op: "disable",
  strategy: "auto",
  preview: null,
  previewLoading: false,
  previewError: undefined,
  applyStatus: "idle",
  applyResult: null,
  applyError: undefined,
};

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

  // --- drawer ---
  drawer: DrawerSlice;

  // --- actions ---
  load: () => Promise<void>;
  toggleSelect: (key: string) => void;
  clearSelection: () => void;
  setKindFilter: (k: ReadonlySet<ResourceKind>) => void;
  setToolFilter: (t: ReadonlySet<ToolId>) => void;
  setSearch: (s: string) => void;
  openDrawer: (target: Resource, op: ResourceOp) => Promise<void>;
  closeDrawer: () => void;
  setDrawerOp: (op: ResourceOp) => Promise<void>;
  setDrawerStrategy: (strategy: Strategy) => Promise<void>;
  applyChange: () => Promise<void>;
}

const ALL_KINDS: ReadonlySet<ResourceKind> = new Set([
  "skill",
  "subagent",
  "mcp_server",
]);

/**
 * Fetch a fresh preview for the current drawer target / op / strategy
 * and reconcile the drawer slice. Used by openDrawer + setDrawerOp +
 * setDrawerStrategy so the drawer always shows a diff consistent with
 * the currently-selected knobs.
 */
async function refreshPreview(
  get: () => State,
  set: (partial: Partial<State> | ((s: State) => Partial<State>)) => void,
): Promise<void> {
  const { target, op, strategy } = get().drawer;
  if (!target) return;
  set((s) => ({
    drawer: { ...s.drawer, previewLoading: true, previewError: undefined },
  }));
  try {
    const preview = await previewResource({ resource: target, op, strategy });
    set((s) => ({
      drawer: { ...s.drawer, preview, previewLoading: false },
    }));
  } catch (e) {
    set((s) => ({
      drawer: {
        ...s.drawer,
        preview: null,
        previewLoading: false,
        previewError: e instanceof Error ? e.message : String(e),
      },
    }));
  }
}

export const useStore = create<State>((set, get) => ({
  status: "idle",
  error: undefined,
  resources: [],
  kindFilter: ALL_KINDS,
  toolFilter: new Set<ToolId>(),
  search: "",
  selected: new Set<string>(),
  drawer: EMPTY_DRAWER,

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

  async openDrawer(target, op) {
    // Sensible default op: if a resource is currently on, default to disable.
    const initialOp: ResourceOp = op ?? (target.enabled ? "disable" : "enable");
    set({
      drawer: {
        ...EMPTY_DRAWER,
        target,
        op: initialOp,
      },
    });
    await refreshPreview(get, set);
  },

  closeDrawer() {
    set({ drawer: EMPTY_DRAWER });
  },

  async setDrawerOp(op) {
    set((s) => ({
      drawer: { ...s.drawer, op, applyStatus: "idle", applyError: undefined },
    }));
    await refreshPreview(get, set);
  },

  async setDrawerStrategy(strategy) {
    set((s) => ({
      drawer: { ...s.drawer, strategy, applyStatus: "idle", applyError: undefined },
    }));
    await refreshPreview(get, set);
  },

  async applyChange() {
    const { target, op, strategy } = get().drawer;
    if (!target) return;
    set((s) => ({
      drawer: { ...s.drawer, applyStatus: "applying", applyError: undefined },
    }));
    try {
      const result = await applyResource({
        resource: target,
        op,
        strategy,
        opts: {},
      });
      set((s) => ({
        drawer: {
          ...s.drawer,
          applyStatus: result.ok ? "done" : "error",
          applyResult: result,
          applyError: result.ok ? undefined : result.warnings.join("; ") || "Apply failed",
        },
      }));
      if (result.ok && result.applied) {
        // Re-fetch the catalog so the row's `enabled` flips correctly.
        await get().load();
      }
    } catch (e) {
      set((s) => ({
        drawer: {
          ...s.drawer,
          applyStatus: "error",
          applyError: e instanceof Error ? e.message : String(e),
        },
      }));
    }
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
