import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  AccountDetailSchema,
  AccountListResponseSchema,
  DealSchema,
  PipelineSummarySchema,
  VisitSchema,
} from "@fieldpulse/contracts";
import { auth, sampleAccount, setup } from "./helpers.js";

async function withAccount() {
  const ctx = await setup();
  const token = await ctx.login("rep@example.com");
  const res = await request(ctx.app).post("/accounts").set(auth(token)).send(sampleAccount);
  expect(res.status).toBe(201);
  return { ...ctx, token, accountId: res.body.id as string };
}

describe("accounts", () => {
  it("creates, lists with search and paginates", async () => {
    const { app, token } = await withAccount();
    await request(app).post("/accounts").set(auth(token)).send({ ...sampleAccount, name: "Mission Hardware", industry: "Hardware" });

    const res = await request(app).get("/accounts?search=hard&pageSize=10").set(auth(token));
    const body = AccountListResponseSchema.parse(res.body);
    expect(body.items.map((a) => a.name)).toEqual(["Mission Hardware"]);
    expect(body.total).toBe(1);
    expect(body.pageSize).toBe(10);
  });

  it("scopes reps to their own accounts but lets managers see all", async () => {
    const { app, accountId, login } = await withAccount();
    const other = await login("other@example.com");
    const manager = await login("boss@example.com");
    expect((await request(app).get(`/accounts/${accountId}`).set(auth(other))).status).toBe(404);
    const res = await request(app).get(`/accounts/${accountId}`).set(auth(manager));
    expect(res.status).toBe(200);
    expect(AccountDetailSchema.parse(res.body).contacts).toEqual([]);
  });

  it("adds contacts and patches fields", async () => {
    const { app, token, accountId } = await withAccount();
    const c = await request(app)
      .post(`/accounts/${accountId}/contacts`)
      .set(auth(token))
      .send({ name: "Pat Buyer", email: "pat@example.com" });
    expect(c.status).toBe(201);

    const p = await request(app).patch(`/accounts/${accountId}`).set(auth(token)).send({ tier: "B" });
    expect(p.body.tier).toBe("B");

    const detail = await request(app).get(`/accounts/${accountId}`).set(auth(token));
    expect(detail.body.contacts[0].name).toBe("Pat Buyer");
  });

  it("returns 404 for malformed ids and unknown routes", async () => {
    const { app, token } = await withAccount();
    expect((await request(app).get("/accounts/not-a-uuid").set(auth(token))).status).toBe(404);
    expect((await request(app).get("/nope").set(auth(token))).status).toBe(404);
  });
});

describe("visits", () => {
  it("schedules and completes a visit, updating the account's last visit", async () => {
    const { app, token, accountId } = await withAccount();
    const scheduled = await request(app)
      .post("/visits")
      .set(auth(token))
      .send({ accountId, scheduledAt: "2026-10-08T16:00:00.000Z" });
    expect(scheduled.status).toBe(201);

    const done = await request(app)
      .post(`/visits/${scheduled.body.id}/complete`)
      .set(auth(token))
      .send({
        completedAt: "2026-10-08T16:45:00.000Z",
        outcome: "follow_up_needed",
        followUpAt: "2026-10-15T16:00:00.000Z",
        notes: "Wants pricing for 12 lanes",
        checkInLocation: sampleAccount.location,
      });
    expect(done.status).toBe(200);
    expect(VisitSchema.parse(done.body).outcome).toBe("follow_up_needed");

    const account = await request(app).get(`/accounts/${accountId}`).set(auth(token));
    expect(account.body.lastVisitAt).toBe("2026-10-08T16:45:00.000Z");

    const again = await request(app)
      .post(`/visits/${scheduled.body.id}/complete`)
      .set(auth(token))
      .send({ completedAt: "2026-10-08T17:00:00.000Z", outcome: "productive" });
    expect(again.status).toBe(409);
  });

  it("filters by status", async () => {
    const { app, token, accountId } = await withAccount();
    await request(app).post("/visits").set(auth(token)).send({ accountId, scheduledAt: "2026-10-09T10:00:00.000Z" });
    const res = await request(app).get("/visits?status=completed").set(auth(token));
    expect(res.body.visits).toEqual([]);
  });

  it("replays idempotent mutations instead of applying them twice", async () => {
    const { app, token, accountId, repo } = await withAccount();
    const send = () =>
      request(app)
        .post("/visits")
        .set(auth(token))
        .set("Idempotency-Key", "offline-123")
        .send({ accountId, scheduledAt: "2026-10-09T10:00:00.000Z" });
    const first = await send();
    const second = await send();
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(second.body.id).toBe(first.body.id);
    expect(repo.visits.size).toBe(1);
  });
});

describe("deals and pipeline", () => {
  async function withDeal() {
    const ctx = await withAccount();
    const res = await request(ctx.app)
      .post("/deals")
      .set(auth(ctx.token))
      .send({ accountId: ctx.accountId, title: "POS refresh", amountCents: 400_000, expectedCloseDate: "2026-11-20" });
    expect(res.status).toBe(201);
    return { ...ctx, deal: DealSchema.parse(res.body) };
  }

  it("moves deals through allowed stages and rejects illegal jumps", async () => {
    const { app, token, deal } = await withDeal();
    const ok = await request(app).patch(`/deals/${deal.id}/stage`).set(auth(token)).send({ stage: "proposal" });
    expect(ok.status).toBe(200);

    const back2 = await request(app).patch(`/deals/${deal.id}/stage`).set(auth(token)).send({ stage: "prospecting" });
    expect(back2.status).toBe(422);
    expect(back2.body.error.code).toBe("invalid_transition");
  });

  it("requires a reason to close lost and stamps closedAt", async () => {
    const { app, token, deal } = await withDeal();
    const missing = await request(app).patch(`/deals/${deal.id}/stage`).set(auth(token)).send({ stage: "closed_lost" });
    expect(missing.status).toBe(400);
    const lost = await request(app)
      .patch(`/deals/${deal.id}/stage`)
      .set(auth(token))
      .send({ stage: "closed_lost", lostReason: "Budget frozen" });
    expect(lost.body.closedAt).toBe("2026-10-08T12:00:00.000Z");
    expect(lost.body.lostReason).toBe("Budget frozen");
  });

  it("detects concurrent edits via expectedUpdatedAt", async () => {
    const { app, token, deal, advance } = await withDeal();
    advance(1000);
    await request(app).patch(`/deals/${deal.id}/stage`).set(auth(token)).send({ stage: "qualified" });
    const stale = await request(app)
      .patch(`/deals/${deal.id}/stage`)
      .set(auth(token))
      .send({ stage: "proposal", expectedUpdatedAt: deal.updatedAt });
    expect(stale.status).toBe(409);
  });

  it("summarises the pipeline against the rep's quota", async () => {
    const { app, token, deal } = await withDeal();
    await request(app).patch(`/deals/${deal.id}/stage`).set(auth(token)).send({ stage: "negotiation" });
    const res = await request(app).get("/pipeline/summary").set(auth(token));
    const summary = PipelineSummarySchema.parse(res.body);
    expect(summary.totalOpenCents).toBe(400_000);
    expect(summary.totalWeightedCents).toBe(300_000);
    expect(summary.quota.targetCents).toBe(1_000_000);
    expect(summary.quota.projectedAttainment).toBeCloseTo(0.3);
  });
});
