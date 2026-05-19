import { z } from "zod";
import {
  toMcpServerResource,
  toSkillResource,
  toSubagentResource,
} from "@domain/convert.js";
import type {
  McpServerRecord,
  SkillRecord,
  SubagentRecord,
} from "@src/types.js";
import {
  ApplyRequestSchema,
  DiffPreviewSchema,
  MutationResultSchema,
  PreviewRequestSchema,
  type ApplyRequest,
  type DiffPreview,
  type MutationResult,
  type PreviewRequest,
  type Resource,
} from "./types";

/**
 * Thin HTTP client for the local skill-manager UI server.
 *
 * Every response is validated against a zod schema — no `any` slips in
 * past this module. Errors bundle the HTTP status, parsed body (if
 * available) and a human message so the UI can show actionable hints.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function jsonFetch<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    throw new ApiError(0, undefined, e instanceof Error ? e.message : "Network error");
  }
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `HTTP ${res.status}`;
    throw new ApiError(res.status, data, msg);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(res.status, data, `Response did not match schema: ${parsed.error.message}`);
  }
  return parsed.data;
}

async function postJson<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  return jsonFetch(
    path,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    schema,
  );
}

async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return jsonFetch(path, { method: "GET" }, schema);
}

// --- v2 (preview / apply) ---

export async function previewResource(req: PreviewRequest): Promise<DiffPreview> {
  // Round-trip through the request schema so the frontend can't accidentally
  // send a malformed body — useful catch during dev.
  const safeReq = PreviewRequestSchema.parse(req);
  return postJson("/api/v2/resources/preview", safeReq, DiffPreviewSchema);
}

export async function applyResource(req: ApplyRequest): Promise<MutationResult> {
  const safeReq = ApplyRequestSchema.parse(req);
  return postJson("/api/v2/resources/apply", safeReq, MutationResultSchema);
}

// --- v1 (discovery; v2 list endpoints land in a later phase) ---

const SkillRecordSchema = z.looseObject({ tool: z.string(), id: z.string() });
const SubagentRecordSchema = z.looseObject({ tool: z.string(), id: z.string() });
const McpRecordSchema = z.looseObject({
  tool: z.string(),
  id: z.string(),
  envKeys: z.array(z.string()).optional().default([]),
});

const SkillArraySchema = z.array(SkillRecordSchema);
const SubagentArraySchema = z.array(SubagentRecordSchema);
const McpArraySchema = z.array(McpRecordSchema);

/**
 * Fetch the full Resource catalog by hitting all three v1 endpoints in
 * parallel and normalising the legacy *Record shapes to Resource via
 * the shared to*Resource() helpers (kind discriminator added).
 *
 * The schema is loose on purpose: v1 has no canonical shape contract,
 * so we trust the backend's existing TS types and only assert the
 * minimum we rely on (tool + id). v2 list endpoints (a future phase)
 * will tighten this.
 */
export async function listResources(): Promise<Resource[]> {
  const [skills, subagents, mcps] = await Promise.all([
    getJson("/api/v1/skills", SkillArraySchema),
    getJson("/api/v1/agents", SubagentArraySchema),
    getJson("/api/v1/mcp", McpArraySchema),
  ]);
  // The v1 endpoints are existing infrastructure (commit 38bee6ed); they
  // already return well-formed *Record objects but lack a schema contract.
  // We trust them and project onto Resource via the shared adapters.
  return [
    ...skills.map((r) => toSkillResource(r as unknown as SkillRecord)),
    ...subagents.map((r) => toSubagentResource(r as unknown as SubagentRecord)),
    ...mcps.map((r) => toMcpServerResource(r as unknown as McpServerRecord)),
  ];
}
