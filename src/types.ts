export type ToolId = "claude-code" | "cursor" | "vscode" | "codebuddy" | "agents";

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

export type ControlStrategy = "auto" | "native" | "managed";

export interface CliContext {
  homedir: string;
  projectDir?: string;
  dryRun: boolean;
}
