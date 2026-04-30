import type { Command } from "commander";

/**
 * Legacy v1 commands are still registered in src/cli.ts for backwards compatibility.
 * This module exists to make the intent explicit during refactors.
 */
export function registerLegacyCommands(_program: Command): void {
  // Intentionally empty for now.
}

