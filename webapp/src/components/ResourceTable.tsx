import { useMemo } from "react";
import { filterResources, resourceKey, useStore } from "../store";
import type { Resource, ResourceKind } from "@domain/types.js";

const KIND_BADGE: Record<ResourceKind, string> = {
  skill: "bg-emerald-500/15 text-emerald-300",
  subagent: "bg-violet-500/15 text-violet-300",
  mcp_server: "bg-amber-500/15 text-amber-300",
};

const KIND_LABEL: Record<ResourceKind, string> = {
  skill: "skill",
  subagent: "subagent",
  mcp_server: "mcp",
};

function Row({ r }: { r: Resource }) {
  const selected = useStore((s) => s.selected);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const openDrawer = useStore((s) => s.openDrawer);
  const key = resourceKey(r);
  const isSelected = selected.has(key);

  return (
    <tr
      className={
        "border-b border-zinc-800/60 hover:bg-zinc-900/50 transition-colors " +
        (isSelected ? "bg-sky-500/5" : "")
      }
    >
      <td className="p-2 w-8 align-middle">
        <input
          type="checkbox"
          aria-label={`Select ${r.id}`}
          checked={isSelected}
          onChange={() => toggleSelect(key)}
          className="accent-sky-500"
        />
      </td>
      <td className="p-2 align-middle">
        <span className={"text-[10px] px-1.5 py-0.5 rounded " + KIND_BADGE[r.kind]}>
          {KIND_LABEL[r.kind]}
        </span>
      </td>
      <td className="p-2 align-middle text-zinc-400 text-xs">{r.tool}</td>
      <td className="p-2 align-middle">
        <div className="font-medium text-sm">{r.displayName}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{r.id}</div>
      </td>
      <td className="p-2 align-middle text-zinc-400 text-xs max-w-md truncate">
        {r.description || (
          <span className="italic text-zinc-600">no description</span>
        )}
      </td>
      <td className="p-2 align-middle">
        <span
          className={
            "text-[10px] px-1.5 py-0.5 rounded " +
            (r.enabled
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-zinc-700/40 text-zinc-400")
          }
        >
          {r.enabled ? "on" : "off"}
        </span>
      </td>
      <td className="p-2 align-middle">
        <button
          type="button"
          onClick={() => openDrawer(r, r.enabled ? "disable" : "enable")}
          className="text-xs px-2 py-1 rounded border border-zinc-700 hover:border-sky-500 hover:text-sky-300 transition-colors"
        >
          Preview
        </button>
      </td>
    </tr>
  );
}

export default function ResourceTable() {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const resources = useStore((s) => s.resources);
  const kindFilter = useStore((s) => s.kindFilter);
  const toolFilter = useStore((s) => s.toolFilter);
  const search = useStore((s) => s.search);

  const filtered = useMemo(
    () => filterResources(resources, kindFilter, toolFilter, search),
    [resources, kindFilter, toolFilter, search],
  );

  if (status === "loading") {
    return <div className="text-zinc-500 text-sm py-12 text-center">Loading…</div>;
  }
  if (status === "error") {
    return (
      <div className="rounded border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-300">
        Failed to load resources: {error}
      </div>
    );
  }
  if (filtered.length === 0) {
    return (
      <div className="text-zinc-500 text-sm py-12 text-center">
        {resources.length === 0
          ? "No resources discovered."
          : "No resources match the current filters."}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-900/60 text-[10px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="p-2 w-8"></th>
            <th className="p-2">Kind</th>
            <th className="p-2">Tool</th>
            <th className="p-2">Name / id</th>
            <th className="p-2">Description</th>
            <th className="p-2">Status</th>
            <th className="p-2 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <Row key={resourceKey(r)} r={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
