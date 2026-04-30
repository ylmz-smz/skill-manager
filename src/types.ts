export type ToolId =
  | "claude-code"
  | "cursor"
  | "vscode"
  | "codebuddy"
  | "agents"
  | "codex";

export type SourceKind =
  | "user-global"
  | "project"
  | "plugin"
  | "cursor-builtin";

/** How `enabled` was determined */
export type EnabledSemantic = "native" | "managed";

export type SkillKind = "markdown" | "cursor-builtin";

export interface SkillRecord {
  tool: ToolId;
  /** Stable id: frontmatter name, or directory name, or builtin id */
  id: string;
  displayName: string;
  description: string;
  /** Optional localized descriptions (from frontmatter `description: {zh,en}`) */
  descriptionI18n?: {
    zh?: string;
    en?: string;
  };
  sourceKind: SourceKind;
  /** Directory containing SKILL.md, or synthetic path for builtins */
  path: string;
  invocation?: {
    disableModelInvocation?: boolean;
  };
  enabled: boolean;
  enabledSemantic: EnabledSemantic;
  skillKind: SkillKind;
  /** Claude plugin key for settings `enabledPlugins`, e.g. name@marketplace */
  pluginKey?: string;
  /** Hint for users / doctor */
  notes?: string;
}

export type ControlStrategy = "auto" | "native" | "managed" | "symlink";

export interface CliContext {
  homedir: string;
  projectDir?: string;
  dryRun: boolean;
}

// ---- Subagents (Cursor / Claude / Codex compatibility paths) ----

export type SubagentToolId = Extract<ToolId, "cursor" | "claude-code" | "codex">;

export interface SubagentRecord {
  tool: SubagentToolId;
  /** Stable id: frontmatter name, or filename (without .md). */
  id: string;
  displayName: string;
  description: string;
  sourceKind: Extract<SourceKind, "user-global" | "project">;
  /** Full path to the subagent markdown file */
  path: string;
  enabled: boolean;
  enabledSemantic: EnabledSemantic;
  notes?: string;
}

// ---- MCP servers ----

export type McpToolId = Extract<ToolId, "cursor" | "claude-code">;

export type McpTransport = "stdio" | "http" | "unknown";

export interface McpServerRecord {
  tool: McpToolId;
  id: string;
  displayName: string;
  description: string;
  sourceKind: Extract<SourceKind, "user-global" | "project">;
  /** File path that declared this server */
  path: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  /** Environment variable names only (values are sensitive) */
  envKeys: string[];
  enabled: boolean;
  enabledSemantic: EnabledSemantic;
  notes?: string;
}
