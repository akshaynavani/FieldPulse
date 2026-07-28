import request from "supertest";
import { createApp } from "../src/app.js";
import { MemoryRepository } from "../src/repositories/memory.js";
import { hashPassword } from "../src/services/passwords.js";

export const PASSWORD = "correct-horse-battery";

export async function setup(start = new Date("2026-10-08T12:00:00.000Z")) {
  let current = start;
  const clock = () => current;
  const repo = new MemoryRepository(clock);
  const app = createApp({ repo, now: clock, sessionTtlHours: 24 });
  const passwordHash = await hashPassword(PASSWORD);

  const rep = await repo.createUser({
    email: "rep@example.com",
    name: "Riley Rep",
    role: "rep",
    territory: "SF",
    quarterlyQuotaCents: 1_000_000,
    passwordHash,
  });
  const other = await repo.createUser({
    email: "other@example.com",
    name: "Other Rep",
    role: "rep",
    territory: "LA",
    quarterlyQuotaCents: 1_000_000,
    passwordHash,
  });
  const manager = await repo.createUser({
    email: "boss@example.com",
    name: "Morgan Manager",
    role: "manager",
    territory: "West",
    quarterlyQuotaCents: 5_000_000,
    passwordHash,
  });

  async function login(email: string) {
    const res = await request(app).post("/auth/login").send({ email, password: PASSWORD });
    if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
    return res.body.token as string;
  }

  return {
    app,
    repo,
    rep,
    other,
    manager,
    login,
    advance: (ms: number) => {
      current = new Date(current.getTime() + ms);
    },
  };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export const sampleAccount = {
  name: "Golden Gate Grocers",
  industry: "Grocery",
  tier: "A",
  address: "2100 Market St",
  location: { lat: 37.7671, lng: -122.4294 },
};
