import { z } from "zod";
import { ResourceSchema, StrategySchema } from "../domain/schema.js";
import { createSkillMutationPort } from "../mutation/skill-port.js";
import { createMcpMutationPort } from "../mutation/mcp-port.js";
import { createSubagentMutationPort } from "../mutation/subagent-port.js";
import type { DiffPreview, MutationResult } from "../mutation/port.js";

/**
 * v0.4 HTTP API surface for the new MutationPort layer.
 *
 * POST /api/v2/resources/preview  -> returns DiffPreview (no disk writes)
 * POST /api/v2/resources/apply    -> applies the change (or dry-runs)
 *
 * Body shape is validated entirely by zod schemas derived from the
 * domain layer — there is no hand-written request validator. This is
 * the v0.4 antidote to the v0.3 surface where each endpoint hand-checked
 * `tool` / `id` / `path` strings.
 */

const ApplyOptsSchema = z
  .object({
    dryRun: z.boolean().optional(),
    global: z.boolean().optional(),
    force: z.boolean().optional(),
  })
  .optional()
  .default({});

const OpSchema = z.enum(["enable", "disable"]);

export const PreviewRequestSchema = z.object({
  resource: ResourceSchema,
  op: OpSchema,
  strategy: StrategySchema.optional().default("auto"),
});

export const ApplyRequestSchema = z.object({
  resource: ResourceSchema,
  op: OpSchema,
  strategy: StrategySchema.optional().default("auto"),
  opts: ApplyOptsSchema,
});

export interface PortContext {
  homedir: string;
  projectDir?: string;
  /** From config.unified.roots.skills (used by SkillMutationPort symlink strategy). */
  unifiedRootSkills?: string;
  /** From config.unified.roots.agents (used by SubagentMutationPort symlink strategy). */
  unifiedRootAgents?: string;
  /** From config.mcp.readOnly. */
  mcpReadOnly?: boolean;
}

/**
 * Run a preview against the appropriate MutationPort.
 *
 * Each Resource kind has its own Port with a specifically-typed
 * `preview(resource, ...)` signature, and TS can't carry the
 * discriminant from `parsed.resource` through a generic `getPortFor`
 * helper. The pragmatic shape is a direct `switch` on kind, which
 * lets each case keep the narrow Resource type intact.
 *
 * @throws ZodError if the body shape is invalid (caller maps to 400).
 */
export async function handleV2Preview(
  body: unknown,
  ctx: PortContext,
): Promise<DiffPreview> {
  const { resource, op, strategy } = PreviewRequestSchema.parse(body);
  switch (resource.kind) {
    case "skill":
      return createSkillMutationPort({
        homedir: ctx.homedir,
        projectDir: ctx.projectDir,
        unifiedRoot: ctx.unifiedRootSkills,
      }).preview(resource, op, strategy);
    case "subagent":
      return createSubagentMutationPort({
        homedir: ctx.homedir,
        unifiedRoot: ctx.unifiedRootAgents,
      }).preview(resource, op, strategy);
    case "mcp_server":
      return createMcpMutationPort({
        homedir: ctx.homedir,
        readOnly: ctx.mcpReadOnly,
      }).preview(resource, op, strategy);
  }
}

/**
 * Run an apply against the appropriate MutationPort.
 *
 * @throws ZodError if the body shape is invalid.
 */
export async function handleV2Apply(
  body: unknown,
  ctx: PortContext,
): Promise<MutationResult> {
  const { resource, op, strategy, opts } = ApplyRequestSchema.parse(body);
  switch (resource.kind) {
    case "skill":
      return createSkillMutationPort({
        homedir: ctx.homedir,
        projectDir: ctx.projectDir,
        unifiedRoot: ctx.unifiedRootSkills,
      }).apply(resource, op, strategy, opts);
    case "subagent":
      return createSubagentMutationPort({
        homedir: ctx.homedir,
        unifiedRoot: ctx.unifiedRootAgents,
      }).apply(resource, op, strategy, opts);
    case "mcp_server":
      return createMcpMutationPort({
        homedir: ctx.homedir,
        readOnly: ctx.mcpReadOnly,
      }).apply(resource, op, strategy, opts);
  }
}
