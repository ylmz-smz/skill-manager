import { useEffect, useMemo, useState } from "react";

type Agent = {
  id: string;
  label: string;
  installed: boolean;
  globalRoots: string[];
  projectRoots: string[];
};

type Installation = {
  id: string;
  agentId: string;
  agentLabel: string;
  scope: "global" | "project";
  path: string;
  hash: string;
  isSymlink: boolean;
};

type Skill = {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  canonicalPath?: string;
  canonicalStatus: "managed" | "external";
  installations: Installation[];
  conflict: boolean;
  issues: Array<{ message: string }>;
};

type Inventory = {
  agents: Agent[];
  skills: Skill[];
  libraryPath: string;
  scannedAt: string;
};

type Plan = {
  planId: string;
  riskLevel: "low" | "medium";
  operations: Array<{ id: string; type: string; message: string; targetPath: string; backupPath?: string }>;
  blockedConflicts: string[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data as T;
}

export default function Workbench() {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [libraryPath, setLibraryPath] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"quick" | "managed">("managed");
  const [method, setMethod] = useState<"copy" | "symlink">("symlink");
  const [scope, setScope] = useState<"global" | "project">("global");
  const [projectPath, setProjectPath] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function load(path = libraryPath) {
    setBusy(true);
    setError(undefined);
    try {
      const next = await request<Inventory>(`/api/v2/workbench/inventory${path ? `?libraryPath=${encodeURIComponent(path)}` : ""}`);
      setInventory(next);
      setLibraryPath(next.libraryPath);
      setTargets((current) => current.size ? current : new Set(next.agents.filter((agent) => agent.installed).slice(0, 3).map((agent) => agent.id)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const skills = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inventory?.skills.filter((skill) => !query || skill.displayName.toLowerCase().includes(query) || skill.slug.toLowerCase().includes(query)) ?? [];
  }, [inventory, search]);
  const installedAgents = inventory?.agents.filter((agent) => agent.installed) ?? [];
  const selectedSkills = inventory?.skills.filter((skill) => selected.has(skill.id)) ?? [];

  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setPlan(null);
  }

  async function preview() {
    setBusy(true);
    setError(undefined);
    try {
      const sources = selectedSkills.map((skill) => ({
        slug: skill.slug,
        path: skill.canonicalPath || skill.installations[0]?.path || "",
      })).filter((source) => source.path);
      const targetRows = installedAgents.filter((agent) => targets.has(agent.id)).map((agent) => ({
        agentId: agent.id,
        scope,
        projectPath: scope === "project" ? projectPath : undefined,
      }));
      setPlan(await request<Plan>("/api/v2/workbench/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, method, libraryPath, sources, targets: targetRows }),
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!plan) return;
    setBusy(true);
    setError(undefined);
    try {
      await request("/api/v2/workbench/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: plan.planId }),
      });
      setPlan(null);
      setSelected(new Set());
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!inventory && busy) return <div className="py-16 text-center text-sm text-zinc-500">正在扫描本地 Agent 与 Skills…</div>;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            className="min-w-64 flex-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
            placeholder="搜索 Skill"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <span className="text-xs text-zinc-500">{inventory?.skills.length ?? 0} Skills · {installedAgents.length} Agents</span>
          <button className="rounded border border-zinc-700 px-3 py-2 text-xs hover:border-zinc-500" disabled={busy} onClick={() => void load()} type="button">重新扫描</button>
        </div>

        {error && <div className="mb-4 rounded border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>}

        <div className="overflow-hidden rounded border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/70 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr><th className="w-10 p-3"/><th className="p-3">Skill</th><th className="p-3">覆盖</th><th className="p-3">中心库</th><th className="p-3">状态</th></tr>
            </thead>
            <tbody>
              {skills.map((skill) => (
                <tr className="border-t border-zinc-800/70 hover:bg-zinc-900/40" key={skill.id}>
                  <td className="p-3"><input aria-label={`选择 ${skill.displayName}`} checked={selected.has(skill.id)} className="accent-sky-500" onChange={() => toggle(setSelected, skill.id)} type="checkbox" /></td>
                  <td className="p-3"><strong className="block font-medium">{skill.displayName}</strong><span className="block max-w-md truncate text-xs text-zinc-500">{skill.description || skill.slug}</span></td>
                  <td className="p-3 text-xs text-zinc-400">{skill.installations.length ? skill.installations.map((item) => item.agentLabel).filter((value, index, all) => all.indexOf(value) === index).join(", ") : "未安装"}</td>
                  <td className="p-3 text-xs"><span className={skill.canonicalPath ? "text-emerald-300" : "text-zinc-500"}>{skill.canonicalPath ? "已采纳" : "外部"}</span></td>
                  <td className="p-3 text-xs">{skill.conflict ? <span className="text-amber-300" title={skill.issues.map((issue) => issue.message).join("; ")}>内容冲突</span> : <span className="text-zinc-500">正常</span>}</td>
                </tr>
              ))}
              {skills.length === 0 && <tr><td className="p-10 text-center text-sm text-zinc-500" colSpan={5}>没有匹配的 Skills</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="h-fit rounded border border-zinc-800 bg-zinc-900/40 p-4 lg:sticky lg:top-4">
        <h2 className="font-semibold">同步工作台</h2>
        <p className="mt-1 text-xs text-zinc-500">已选择 {selected.size} 个 Skill</p>

        <label className="mt-4 block text-xs text-zinc-400">中心库路径
          <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 font-mono text-xs" value={libraryPath} onChange={(event) => { setLibraryPath(event.target.value); setPlan(null); }} />
        </label>

        <fieldset className="mt-4"><legend className="mb-2 text-xs text-zinc-400">模式</legend><div className="grid grid-cols-2 gap-2">
          <button className={`rounded border px-3 py-2 text-xs ${mode === "managed" ? "border-sky-500 bg-sky-500/10 text-sky-200" : "border-zinc-700"}`} onClick={() => { setMode("managed"); setPlan(null); }} type="button">中心库管理</button>
          <button className={`rounded border px-3 py-2 text-xs ${mode === "quick" ? "border-sky-500 bg-sky-500/10 text-sky-200" : "border-zinc-700"}`} onClick={() => { setMode("quick"); setPlan(null); }} type="button">快速同步</button>
        </div></fieldset>

        <fieldset className="mt-4"><legend className="mb-2 text-xs text-zinc-400">方式</legend><div className="grid grid-cols-2 gap-2">
          <button className={`rounded border px-3 py-2 text-xs ${method === "symlink" ? "border-sky-500 bg-sky-500/10 text-sky-200" : "border-zinc-700"}`} onClick={() => { setMethod("symlink"); setPlan(null); }} type="button">软链接</button>
          <button className={`rounded border px-3 py-2 text-xs ${method === "copy" ? "border-sky-500 bg-sky-500/10 text-sky-200" : "border-zinc-700"}`} onClick={() => { setMethod("copy"); setPlan(null); }} type="button">复制</button>
        </div></fieldset>

        <fieldset className="mt-4"><legend className="mb-2 text-xs text-zinc-400">目标 Agent</legend><div className="max-h-40 space-y-1 overflow-auto">
          {installedAgents.map((agent) => <label className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-zinc-800/60" key={agent.id}><input checked={targets.has(agent.id)} className="accent-sky-500" onChange={() => toggle(setTargets, agent.id)} type="checkbox" />{agent.label}</label>)}
          {installedAgents.length === 0 && <p className="text-xs text-zinc-500">未检测到已安装 Agent</p>}
        </div></fieldset>

        <fieldset className="mt-4"><legend className="mb-2 text-xs text-zinc-400">范围</legend><div className="grid grid-cols-2 gap-2">
          <button className={`rounded border px-3 py-2 text-xs ${scope === "global" ? "border-sky-500 bg-sky-500/10 text-sky-200" : "border-zinc-700"}`} onClick={() => { setScope("global"); setPlan(null); }} type="button">全局</button>
          <button className={`rounded border px-3 py-2 text-xs ${scope === "project" ? "border-sky-500 bg-sky-500/10 text-sky-200" : "border-zinc-700"}`} onClick={() => { setScope("project"); setPlan(null); }} type="button">项目</button>
        </div></fieldset>
        {scope === "project" && <input className="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 font-mono text-xs" placeholder="项目绝对路径" value={projectPath} onChange={(event) => { setProjectPath(event.target.value); setPlan(null); }} />}

        {plan && <div className="mt-4 rounded border border-zinc-700 bg-zinc-950/70 p-3 text-xs">
          <div className="mb-2 flex justify-between"><strong>操作预览</strong><span className={plan.riskLevel === "medium" ? "text-amber-300" : "text-emerald-300"}>{plan.riskLevel}</span></div>
          <ul className="max-h-40 space-y-1 overflow-auto text-zinc-400">{plan.operations.map((op) => <li key={op.id}>{op.message}{op.backupPath ? "（先备份）" : ""}</li>)}</ul>
          {plan.blockedConflicts.map((message) => <p className="mt-2 text-red-300" key={message}>{message}</p>)}
        </div>}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="rounded border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40" disabled={busy || selected.size === 0 || targets.size === 0 || (scope === "project" && !projectPath)} onClick={() => void preview()} type="button">生成预览</button>
          <button className="rounded bg-sky-500 px-3 py-2 text-sm font-medium text-zinc-950 disabled:opacity-40" disabled={busy || !plan || plan.blockedConflicts.length > 0} onClick={() => void apply()} type="button">确认执行</button>
        </div>
      </aside>
    </div>
  );
}
