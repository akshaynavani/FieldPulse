import { describe, expect, it, vi } from "vitest";
import { ApiError, ContractError, FieldPulseClient, NetworkError, isRetryable } from "../src/index.js";

const user = {
  id: "8f14e45f-ceea-4e7a-9d2c-1b2f3a4b5c6d",
  email: "rep@example.com",
  name: "Riley Rep",
  role: "rep",
  territory: "Bay Area",
  quarterlyQuotaCents: 25_000_000,
};

function jsonResponse(status: number, body: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setup(response: Response | Error, token: string | null = "t".repeat(48)) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const onUnauthorized = vi.fn();
  const client = new FieldPulseClient({
    baseUrl: "https://api.example.com/",
    fetch: fetchMock,
    getToken: () => token,
    onUnauthorized,
  });
  return { client, fetchMock, onUnauthorized };
}

describe("FieldPulseClient", () => {
  it("sends bearer token and parses a valid response", async () => {
    const { client, fetchMock } = setup(jsonResponse(200, user));
    const me = await client.me();
    expect(me.email).toBe("rep@example.com");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.com/auth/me");
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Bearer t+/);
  });

  it("builds query strings and skips empty values", async () => {
    const { client, fetchMock } = setup(jsonResponse(200, { items: [], page: 1, pageSize: 25, total: 0 }));
    await client.listAccounts({ search: "acme", tier: undefined, page: 2 });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.example.com/accounts?search=acme&page=2");
  });

  it("validates request bodies before sending", async () => {
    const { client, fetchMock } = setup(jsonResponse(200, {}));
    await expect(
      client.updateDealStage(user.id, { stage: "closed_lost" }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("raises ContractError when the server drifts from the schema", async () => {
    const { client } = setup(jsonResponse(200, { ...user, role: "admin" }));
    await expect(client.me()).rejects.toBeInstanceOf(ContractError);
  });

  it("maps structured API errors and notifies on 401", async () => {
    const { client, onUnauthorized } = setup(
      jsonResponse(401, { error: { code: "unauthorized", message: "Session expired" } }),
    );
    const err = await client.me().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("unauthorized");
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(isRetryable(err)).toBe(false);
  });

  it("wraps fetch failures as retryable NetworkError", async () => {
    const { client } = setup(new TypeError("Network request failed"));
    const err = await client.pipelineSummary().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect(isRetryable(err)).toBe(true);
  });

  it("handles 204 responses for logout", async () => {
    const { client } = setup(new Response(null, { status: 204 }));
    await expect(client.logout()).resolves.toBeNull();
  });

  it("forwards idempotency keys", async () => {
    const visit = {
      id: user.id,
      accountId: user.id,
      repId: user.id,
      scheduledAt: "2026-10-08T09:00:00.000Z",
      completedAt: "2026-10-08T10:00:00.000Z",
      outcome: "productive",
      notes: "",
      followUpAt: null,
      checkInLocation: null,
    };
    const { client, fetchMock } = setup(jsonResponse(200, visit));
    await client.completeVisit(
      user.id,
      { completedAt: "2026-10-08T10:00:00.000Z", outcome: "productive" },
      "mut-1",
    );
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("mut-1");
  });
});
