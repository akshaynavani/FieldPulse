import type { RouteQuery } from "@fieldpulse/contracts";

/** Centralised query keys so invalidation is consistent across both apps. */
export const queryKeys = {
  me: ["me"] as const,
  sessions: ["sessions"] as const,
  accounts: (q: RouteQuery<"listAccounts"> = {}) => ["accounts", q] as const,
  account: (id: string) => ["account", id] as const,
  visits: (q: RouteQuery<"listVisits"> = {}) => ["visits", q] as const,
  deals: (q: RouteQuery<"listDeals"> = {}) => ["deals", q] as const,
  pipeline: ["pipeline"] as const,
};
