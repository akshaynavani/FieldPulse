import type { Account, Deal, DealStage } from "@fieldpulse/contracts";

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

export function deal(stage: DealStage, amountCents: number, extra: Partial<Deal> = {}): Deal {
  return {
    id: id(),
    accountId: id(),
    ownerId: id(),
    title: `Deal ${n}`,
    amountCents,
    currency: "USD",
    stage,
    expectedCloseDate: "2026-11-15",
    lostReason: null,
    closedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...extra,
  };
}

export function account(name: string, extra: Partial<Account> = {}): Account {
  return {
    id: id(),
    name,
    industry: "Retail",
    tier: "B",
    address: "1 Main St",
    location: { lat: 37.77, lng: -122.42 },
    ownerId: id(),
    lastVisitAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}
