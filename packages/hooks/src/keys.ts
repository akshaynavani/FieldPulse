import type { AccountListQuery, DealListQuery, VisitListQuery } from "@fieldpulse/contracts";

/** Centralised query keys so invalidation is consistent across both apps. */
export const queryKeys = {
  me: ["me"] as const,
  sessions: ["sessions"] as const,
  accounts: (q: Partial<AccountListQuery> = {}) => ["accounts", q] as const,
  account: (id: string) => ["account", id] as const,
  visits: (q: Partial<VisitListQuery> = {}) => ["visits", q] as const,
  deals: (q: Partial<DealListQuery> = {}) => ["deals", q] as const,
  pipeline: ["pipeline"] as const,
};
