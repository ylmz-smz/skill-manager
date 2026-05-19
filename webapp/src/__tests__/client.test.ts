import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, previewResource } from "../api/client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ApiError", () => {
  it("carries status, body and message", () => {
    const err = new ApiError(400, { error: "Bad" }, "Bad");
    expect(err.status).toBe(400);
    expect(err.body).toEqual({ error: "Bad" });
    expect(err.message).toBe("Bad");
    expect(err.name).toBe("ApiError");
  });
});

describe("previewResource", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const request = {
    resource: {
      kind: "skill" as const,
      tool: "cursor" as const,
      id: "alpha",
      displayName: "Alpha",
      description: "",
      sourceKind: "user-global" as const,
      path: "/tmp/alpha",
      enabled: true,
      enabledSemantic: "native" as const,
      skillKind: "markdown" as const,
    },
    op: "disable" as const,
    strategy: "auto" as const,
  };

  it("returns a parsed DiffPreview on 200", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        files: [],
        unifiedDiff: "",
        redactedEnvKeys: [],
        warnings: [],
      }),
    );
    const result = await previewResource(request);
    expect(result.unifiedDiff).toBe("");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v2/resources/preview",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws ApiError with server `error` message on 400", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Invalid request" }, 400));
    await expect(previewResource(request)).rejects.toMatchObject({
      status: 400,
      message: "Invalid request",
    });
  });

  it("throws ApiError when response shape doesn't match schema", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ unexpected: "shape" }));
    await expect(previewResource(request)).rejects.toThrow(/schema/i);
  });

  it("throws ApiError(status=0) on network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network down"));
    await expect(previewResource(request)).rejects.toMatchObject({
      status: 0,
    });
  });
});
