import type { McpTransport } from "../types.js";

export type McpServersJson = {
  mcpServers?: Record<string, unknown>;
};

export interface ParsedMcpServer {
  id: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  envKeys: string[];
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const x of v) if (typeof x === "string") out.push(x);
  return out;
}

function envKeysFrom(v: unknown): string[] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  return Object.keys(v as Record<string, unknown>).sort();
}

function detectTransport(server: Record<string, unknown>): McpTransport {
  const t = server.type;
  if (t === "stdio" || t === "http") return t;
  if (typeof server.command === "string") return "stdio";
  if (typeof server.url === "string") return "http";
  return "unknown";
}

export function parseMcpServersFromJson(raw: string): ParsedMcpServer[] {
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!j || typeof j !== "object") return [];
  const servers = (j as McpServersJson).mcpServers;
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) return [];

  const out: ParsedMcpServer[] = [];
  for (const [id, v] of Object.entries(servers)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const server = v as Record<string, unknown>;
    const transport = detectTransport(server);
    const command = typeof server.command === "string" ? server.command : undefined;
    const args = asStringArray(server.args);
    const url = typeof server.url === "string" ? server.url : undefined;
    const envKeys = envKeysFrom(server.env);
    out.push({ id, transport, command, args, url, envKeys });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

