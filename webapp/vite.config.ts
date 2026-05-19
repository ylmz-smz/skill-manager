import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/**
 * Vite config for the v0.4 React/Tailwind UI.
 *
 * `@domain/*` aliases reach into the main package's src/domain/ so the
 * frontend can re-use the zod schemas (Resource, Strategy, …) without
 * duplicating types. This keeps the schema as the single source of truth
 * across the HTTP boundary.
 *
 * Dev server proxies /api/* to the running CLI's local HTTP server (the
 * one started by `skills-manager ui`) so `pnpm dev` works against a real
 * backend.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@domain": resolve(__dirname, "../src/domain"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3210",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    // Keep the default chunking for now. P3.7 (inline into webapp.ts)
    // will revisit if we need a single-file artefact for CLI embedding.
  },
});
