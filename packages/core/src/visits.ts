import type { Account, AccountTier, LatLng, Visit } from "@fieldpulse/contracts";
import { haversineKm } from "./geo.js";

const DAY_MS = 86_400_000;

/** How often each account tier should be visited, in days. */
export const VISIT_CADENCE_DAYS: Record<AccountTier, number> = { A: 14, B: 30, C: 60 };

export interface DueAccount {
  account: Account;
  daysSinceVisit: number | null;
  daysOverdue: number;
}

/**
 * Accounts that are due (or overdue) for a visit given their tier cadence,
 * most overdue first; never-visited accounts are treated as maximally overdue.
 */
export function accountsDueForVisit(accounts: readonly Account[], now: Date = new Date()): DueAccount[] {
  return accounts
    .map((account) => {
      const cadence = VISIT_CADENCE_DAYS[account.tier];
      if (!account.lastVisitAt) {
        return { account, daysSinceVisit: null, daysOverdue: Number.POSITIVE_INFINITY };
      }
      const since = Math.floor((now.getTime() - Date.parse(account.lastVisitAt)) / DAY_MS);
      return { account, daysSinceVisit: since, daysOverdue: since - cadence };
    })
    .filter((d) => d.daysOverdue >= 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue || a.account.name.localeCompare(b.account.name));
}

export interface RouteStop<T> {
  item: T;
  legKm: number;
  cumulativeKm: number;
}

/**
 * Order stops with a nearest-neighbour heuristic starting from `origin`, then improve
 * with 2-opt. Good enough for a day's worth of visits (tens of stops).
 */
export function planRoute<T extends { location: LatLng }>(
  origin: LatLng,
  stops: readonly T[],
): RouteStop<T>[] {
  if (stops.length === 0) return [];

  const remaining = [...stops];
  const order: T[] = [];
  let current = origin;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    remaining.forEach((s, i) => {
      const d = haversineKm(current, s.location);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    const [next] = remaining.splice(bestIdx, 1);
    order.push(next!);
    current = next!.location;
  }

  const improved = twoOpt(origin, order);

  let cumulative = 0;
  let prev = origin;
  return improved.map((item) => {
    const legKm = haversineKm(prev, item.location);
    cumulative += legKm;
    prev = item.location;
    return { item, legKm, cumulativeKm: cumulative };
  });
}

function routeLength<T extends { location: LatLng }>(origin: LatLng, order: readonly T[]): number {
  let total = 0;
  let prev = origin;
  for (const s of order) {
    total += haversineKm(prev, s.location);
    prev = s.location;
  }
  return total;
}

function twoOpt<T extends { location: LatLng }>(origin: LatLng, order: T[]): T[] {
  let best = order;
  let bestLen = routeLength(origin, best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const len = routeLength(origin, candidate);
        if (len + 1e-9 < bestLen) {
          best = candidate;
          bestLen = len;
          improved = true;
        }
      }
    }
  }
  return best;
}

/** Completed visits whose follow-up date has passed, oldest first. */
export function overdueFollowUps(visits: readonly Visit[], now: Date = new Date()): Visit[] {
  return visits
    .filter((v) => v.followUpAt !== null && Date.parse(v.followUpAt) < now.getTime())
    .sort((a, b) => a.followUpAt!.localeCompare(b.followUpAt!));
}

/** Scheduled (not yet completed) visits falling on the same UTC day as `day`. */
export function visitsForDay(visits: readonly Visit[], day: Date): Visit[] {
  const key = day.toISOString().slice(0, 10);
  return visits
    .filter((v) => v.completedAt === null && v.scheduledAt.slice(0, 10) === key)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}
