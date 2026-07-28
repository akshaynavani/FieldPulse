import request from "supertest";
import { describe, expect, it } from "vitest";
import { LoginResponseSchema, SessionListResponseSchema } from "@fieldpulse/contracts";
import { hashToken } from "../src/services/sessions.js";
import { PASSWORD, auth, setup } from "./helpers.js";

describe("auth", () => {
  it("logs in with a valid password and returns a contract-valid response", async () => {
    const { app } = await setup();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "REP@example.com", password: PASSWORD, deviceLabel: "iPhone" });
    expect(res.status).toBe(200);
    expect(LoginResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it("stores only a hash of the session token", async () => {
    const { app, repo } = await setup();
    const res = await request(app).post("/auth/login").send({ email: "rep@example.com", password: PASSWORD });
    const [session] = [...repo.sessions.values()];
    expect(session!.tokenHash).toBe(hashToken(res.body.token));
    expect(session!.tokenHash).not.toBe(res.body.token);
  });

  it("rejects bad credentials with the same error for unknown users", async () => {
    const { app } = await setup();
    const wrong = await request(app).post("/auth/login").send({ email: "rep@example.com", password: "nope-nope-nope" });
    const unknown = await request(app).post("/auth/login").send({ email: "ghost@example.com", password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("returns 400 with issues for malformed login bodies", async () => {
    const { app } = await setup();
    const res = await request(app).post("/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.issues.length).toBeGreaterThan(0);
  });

  it("requires a bearer token on protected routes", async () => {
    const { app } = await setup();
    expect((await request(app).get("/auth/me")).status).toBe(401);
    expect((await request(app).get("/accounts").set(auth("garbage"))).status).toBe(401);
  });

  it("expires idle sessions and slides active ones", async () => {
    const { app, login, advance } = await setup();
    const token = await login("rep@example.com");
    advance(20 * 3_600_000);
    expect((await request(app).get("/auth/me").set(auth(token))).status).toBe(200);
    // Activity at hour 20 pushed expiry to hour 44, so hour 40 is still valid.
    advance(20 * 3_600_000);
    expect((await request(app).get("/auth/me").set(auth(token))).status).toBe(200);
    advance(25 * 3_600_000);
    expect((await request(app).get("/auth/me").set(auth(token))).status).toBe(401);
  });

  it("logs out and lists/revokes other sessions", async () => {
    const { app, login } = await setup();
    const phone = await login("rep@example.com");
    const laptop = await login("rep@example.com");

    const list = await request(app).get("/auth/sessions").set(auth(laptop));
    const parsed = SessionListResponseSchema.parse(list.body);
    expect(parsed.sessions).toHaveLength(2);
    const phoneSession = parsed.sessions.find((s) => !s.current)!;

    const revoke = await request(app).delete(`/auth/sessions/${phoneSession.id}`).set(auth(laptop));
    expect(revoke.status).toBe(204);
    expect((await request(app).get("/auth/me").set(auth(phone))).status).toBe(401);

    expect((await request(app).post("/auth/logout").set(auth(laptop))).status).toBe(204);
    expect((await request(app).get("/auth/me").set(auth(laptop))).status).toBe(401);
  });

  it("cannot revoke another user's session", async () => {
    const { app, login } = await setup();
    await login("other@example.com");
    const mine = await login("rep@example.com");
    const theirs = await request(app).get("/auth/sessions").set(auth(await login("other@example.com")));
    const id = theirs.body.sessions[0].id;
    expect((await request(app).delete(`/auth/sessions/${id}`).set(auth(mine))).status).toBe(404);
  });
});
