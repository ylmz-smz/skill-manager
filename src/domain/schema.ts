import { z } from "zod";

/**
 * v0.4 domain schemas (single source of truth).
 *
 * These zod schemas define the unified `Resource` model used by the new
 * discovery / mutation Ports. TypeScript types in `./types.ts` are derived
 * from these schemas via `z.infer`, so schema and type stay in lockstep.
 *
 * NOTE (P1.1): not yet wired into the running CLI / UI. Existing
 * `src/types.ts` (SkillRecord / SubagentRecord / McpServerRecord) remains
 * the live model; bridging happens in `./convert.ts` until P1.2/P1.3.
 */

export const ResourceKindSchema = z.enum(["skill", "subagent", "mcp_server"]);

export const ToolIdSchema = z.enum([
  "cursor",
  "claude-code",
  "codex",
  "agents",
  "vscode",
  "codebuddy",
]);

export const SubagentToolIdSchema = z.enum(["cursor", "claude-code", "codex"]);

export const McpToolIdSchema = z.enum(["cursor", "claude-code"]);

/**
 * "or-all" variants used by CLI/HTTP query parsing where the user can
 * pass either a concrete tool id or the special string "all".
 */
export const ToolIdOrAllSchema = z.union([ToolIdSchema, z.literal("all")]);
export const SubagentToolIdOrAllSchema = z.union([
  SubagentToolIdSchema,
  z.literal("all"),
]);
export const McpToolIdOrAllSchema = z.union([
  McpToolIdSchema,
  z.literal("all"),
]);

export const SourceKindSchema = z.enum([
  "user-global",
  "project",
  "plugin",
  "cursor-builtin",
]);

/**
 * Subagents and MCP servers can only originate from user-global or project
 * roots (no plugin marketplace, no IDE built-ins). Encoding this in the
 * schema keeps invalid combinations unrepresentable.
 */
export const NarrowSourceKindSchema = z.enum(["user-global", "project"]);

export const EnabledSemanticSchema = z.enum(["native", "managed"]);

export const StrategySchema = z.enum(["auto", "native", "managed", "symlink"]);

export const SkillKindSchema = z.enum(["markdown", "cursor-builtin"]);

export const McpTransportSchema = z.enum(["stdio", "http", "unknown"]);

const DescriptionI18nSchema = z
  .object({
    zh: z.string().optional(),
    en: z.string().optional(),
  })
  .optional();

const InvocationSchema = z
  .object({
    disableModelInvocation: z.boolean().optional(),
  })
  .optional();

/** Fields shared by every resource regardless of kind. */
const CommonResourceShape = {
  id: z.string().min(1),
  displayName: z.string(),
  description: z.string(),
  path: z.string().min(1),
  enabled: z.boolean(),
  enabledSemantic: EnabledSemanticSchema,
  notes: z.string().optional(),
};

export const SkillResourceSchema = z.object({
  kind: z.literal("skill"),
  tool: ToolIdSchema,
  sourceKind: SourceKindSchema,
  ...CommonResourceShape,
  invocation: InvocationSchema,
  skillKind: SkillKindSchema,
  pluginKey: z.string().optional(),
  descriptionI18n: DescriptionI18nSchema,
});

export const SubagentResourceSchema = z.object({
  kind: z.literal("subagent"),
  tool: SubagentToolIdSchema,
  sourceKind: NarrowSourceKindSchema,
  ...CommonResourceShape,
});

export const McpServerResourceSchema = z.object({
  kind: z.literal("mcp_server"),
  tool: McpToolIdSchema,
  sourceKind: NarrowSourceKindSchema,
  ...CommonResourceShape,
  transport: McpTransportSchema,
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  envKeys: z.array(z.string()),
});

export const ResourceSchema = z.discriminatedUnion("kind", [
  SkillResourceSchema,
  SubagentResourceSchema,
  McpServerResourceSchema,
]);
