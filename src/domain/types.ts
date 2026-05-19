import type { z } from "zod";
import type {
  EnabledSemanticSchema,
  McpServerResourceSchema,
  McpToolIdSchema,
  McpTransportSchema,
  ResourceKindSchema,
  ResourceSchema,
  SkillKindSchema,
  SkillResourceSchema,
  SourceKindSchema,
  StrategySchema,
  SubagentResourceSchema,
  SubagentToolIdSchema,
  ToolIdSchema,
} from "./schema.js";

/**
 * v0.4 domain types.
 *
 * Derived from zod schemas in `./schema.ts` via `z.infer`. The schema is
 * the single source of truth — change the schema and these types follow.
 */

export type ResourceKind = z.infer<typeof ResourceKindSchema>;
export type ToolId = z.infer<typeof ToolIdSchema>;
export type SubagentToolId = z.infer<typeof SubagentToolIdSchema>;
export type McpToolId = z.infer<typeof McpToolIdSchema>;
export type SourceKind = z.infer<typeof SourceKindSchema>;
export type EnabledSemantic = z.infer<typeof EnabledSemanticSchema>;
export type Strategy = z.infer<typeof StrategySchema>;
export type SkillKind = z.infer<typeof SkillKindSchema>;
export type McpTransport = z.infer<typeof McpTransportSchema>;

export type SkillResource = z.infer<typeof SkillResourceSchema>;
export type SubagentResource = z.infer<typeof SubagentResourceSchema>;
export type McpServerResource = z.infer<typeof McpServerResourceSchema>;
export type Resource = z.infer<typeof ResourceSchema>;

/** Narrow a `Resource` to a specific kind. */
export type ResourceOf<K extends ResourceKind> = Extract<Resource, { kind: K }>;
