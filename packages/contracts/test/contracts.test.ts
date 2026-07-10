import { describe, expect, it } from "vitest";
import {
  AccountListQuerySchema,
  CompleteVisitSchema,
  CreateDealSchema,
  LoginRequestSchema,
  UpdateAccountSchema,
  UpdateDealStageSchema,
  buildPath,
  routes,
} from "../src/index.js";

const uuid = "8f14e45f-ceea-4e7a-9d2c-1b2f3a4b5c6d";

describe("LoginRequestSchema", () => {
  it("normalises email casing and whitespace", () => {
    const parsed = LoginRequestSchema.parse({ email: "  Rep@Example.COM ", password: "hunter22!" });
    expect(parsed.email).toBe("rep@example.com");
  });

  it("rejects short passwords", () => {
    expect(LoginRequestSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
  });
});

describe("AccountListQuerySchema", () => {
  it("coerces pagination from query strings and applies defaults", () => {
    expect(AccountListQuerySchema.parse({ page: "3" })).toEqual({ page: 3, pageSize: 25 });
  });

  it("caps page size", () => {
    expect(AccountListQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
  });
});

describe("UpdateAccountSchema", () => {
  it("rejects an empty patch", () => {
    expect(UpdateAccountSchema.safeParse({}).success).toBe(false);
  });
});

describe("CompleteVisitSchema", () => {
  const base = { completedAt: "2026-10-08T15:00:00.000Z", notes: "Met the buyer" };

  it("requires followUpAt when a follow-up is needed", () => {
    const res = CompleteVisitSchema.safeParse({ ...base, outcome: "follow_up_needed" });
    expect(res.success).toBe(false);
  });

  it("requires followUpAt to be after completion", () => {
    const res = CompleteVisitSchema.safeParse({
      ...base,
      outcome: "follow_up_needed",
      followUpAt: "2026-10-01T09:00:00.000Z",
    });
    expect(res.success).toBe(false);
  });

  it("accepts a productive visit with defaults", () => {
    const res = CompleteVisitSchema.parse({ ...base, outcome: "productive" });
    expect(res.followUpAt).toBeNull();
    expect(res.checkInLocation).toBeNull();
  });
});

describe("deal schemas", () => {
  it("defaults currency to USD and rejects fractional cents", () => {
    const deal = CreateDealSchema.parse({
      accountId: uuid,
      title: "Fleet renewal",
      amountCents: 1250000,
      expectedCloseDate: "2026-12-15",
    });
    expect(deal.currency).toBe("USD");
    expect(
      CreateDealSchema.safeParse({ ...deal, amountCents: 10.5 }).success,
    ).toBe(false);
  });

  it("requires a reason when closing lost", () => {
    expect(UpdateDealStageSchema.safeParse({ stage: "closed_lost" }).success).toBe(false);
    expect(
      UpdateDealStageSchema.safeParse({ stage: "closed_lost", lostReason: "Budget cut" }).success,
    ).toBe(true);
  });
});

describe("buildPath", () => {
  it("fills and encodes params", () => {
    expect(buildPath(routes.addContact.path, { id: "a b" })).toBe("/accounts/a%20b/contacts");
  });

  it("throws on a missing param", () => {
    expect(() => buildPath(routes.getAccount.path)).toThrow(/Missing path param/);
  });
});
