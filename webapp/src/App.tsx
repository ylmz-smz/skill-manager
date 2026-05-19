/**
 * Root component for the v0.4 React UI.
 *
 * P3.1 scaffold: renders a placeholder shell that confirms Tailwind v4
 * is wired and the build pipeline is healthy. P3.2 wires up the API
 * client and replaces this body with the real Resource list view.
 */
export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Skill Manager
          </h1>
          <span className="text-xs text-zinc-500 font-mono">v0.4 — phase 3 scaffold</span>
        </div>
        <nav className="flex gap-4 text-sm text-zinc-400">
          <a className="hover:text-zinc-100 transition-colors" href="#resources">
            Resources
          </a>
          <a className="hover:text-zinc-100 transition-colors" href="#config">
            Config
          </a>
          <a className="hover:text-zinc-100 transition-colors" href="#doctor">
            Doctor
          </a>
        </nav>
      </header>

      <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium mb-2">Phase 3 scaffold</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            React 19 + Vite 8 + Tailwind 4 + Zustand 5 are now wired. The
            real Resource list, Diff Preview drawer and Config panel land
            in the next P3 sub-tasks.
          </p>
          <div className="mt-4 flex gap-2 text-xs">
            <span className="rounded bg-emerald-500/10 text-emerald-300 px-2 py-0.5">
              build ok
            </span>
            <span className="rounded bg-sky-500/10 text-sky-300 px-2 py-0.5">
              tailwind ok
            </span>
            <span className="rounded bg-zinc-500/10 text-zinc-300 px-2 py-0.5">
              api wiring pending
            </span>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-3 text-xs text-zinc-500">
        Local-only • No telemetry • <span className="font-mono">/api/v2</span>
      </footer>
    </div>
  );
}
