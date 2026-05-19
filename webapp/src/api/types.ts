import { z } from "zod";
import { ResourceSchema, StrategySchema } from "@domain/schema.js";
import type { Resource } from "@domain/types.js";

/**
 * Cross-boundary contracts for /api/v2.
 *
 * We re-use the zod schemas defined in src/domain/schema.ts (via the
 * '@domain' alias in vite.config.ts + tsconfig paths) so the frontend
 * never disagrees with the backend on what a Resource looks like.
 *
 * v0.4-overhaul.md §4.1 dictates that schema is the only source of
 * truth across the HTTP boundary; this file is the place that contract
 * lives on the frontend side.
 */

export type { Resource };
export type Strategy = z.infer<typeof StrategySchema>;
export type ResourceOp = "enable" | "disable";

export const DiffFileSchema = z.object({
  path: z.string(),
  kind: z.enum(["create", "modify", "delete", "move"]),
  before: z.string().optional(),
  after: z.string().optional(),
});

export const DiffPreviewSchema = z.object({
  files: z.array(DiffFileSchema),
  unifiedDiff: z.string(),
  redactedEnvKeys: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type DiffPreview = z.infer<typeof DiffPreviewSchema>;

export const MutationResultSchema = z.object({
  ok: z.boolean(),
  applied: z.boolean(),
  writtenPaths: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type MutationResult = z.infer<typeof MutationResultSchema>;

export const PreviewRequestSchema = z.object({
  resource: ResourceSchema,
  op: z.enum(["enable", "disable"]),
  strategy: StrategySchema.optional(),
});

export const ApplyRequestSchema = z.object({
  resource: ResourceSchema,
  op: z.enum(["enable", "disable"]),
  strategy: StrategySchema.optional(),
  opts: z
    .object({
      dryRun: z.boolean().optional(),
      global: z.boolean().optional(),
      force: z.boolean().optional(),
    })
    .optional(),
});

export type PreviewRequest = z.infer<typeof PreviewRequestSchema>;
export type ApplyRequest = z.infer<typeof ApplyRequestSchema>;
