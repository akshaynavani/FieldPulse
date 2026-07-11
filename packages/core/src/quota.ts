import type { Deal, PipelineSummary, QuotaProgress } from "@fieldpulse/contracts";
import { isOpen, summarizeStages, weightedAmount, winRate } from "./pipeline.js";

const DAY_MS = 86_400_000;

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Calendar quarter (UTC) containing `now`. End is inclusive. */
export function quarterBounds(now: Date): { start: Date; end: Date } {
  const q = Math.floor(now.getUTCMonth() / 3);
  const start = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), q * 3 + 3, 0));
  return { start, end };
}

function inRange(isoDate: string, start: Date, end: Date): boolean {
  const s = toIsoDate(start);
  const e = toIsoDate(end);
  return isoDate >= s && isoDate <= e;
}

export function computeQuotaProgress(
  deals: readonly Deal[],
  targetCents: number,
  now: Date = new Date(),
): QuotaProgress {
  const { start, end } = quarterBounds(now);

  const closedWonCents = deals
    .filter(
      (d) => d.stage === "closed_won" && d.closedAt && inRange(d.closedAt.slice(0, 10), start, end),
    )
    .reduce((sum, d) => sum + d.amountCents, 0);

  const weightedOpenCents = deals
    .filter((d) => isOpen(d.stage) && inRange(d.expectedCloseDate, start, end))
    .reduce((sum, d) => sum + weightedAmount(d), 0);

  const ratio = (n: number) => (targetCents > 0 ? n / targetCents : 0);
  const endOfDay = end.getTime() + DAY_MS;

  return {
    quarterStart: toIsoDate(start),
    quarterEnd: toIsoDate(end),
    targetCents,
    closedWonCents,
    weightedOpenCents,
    attainment: ratio(closedWonCents),
    projectedAttainment: ratio(closedWonCents + weightedOpenCents),
    daysRemaining: Math.max(0, Math.ceil((endOfDay - now.getTime()) / DAY_MS) - 1),
  };
}

export function summarizePipeline(
  deals: readonly Deal[],
  quotaCents: number,
  now: Date = new Date(),
): PipelineSummary {
  const stages = summarizeStages(deals);
  const open = stages.filter((s) => isOpen(s.stage));
  return {
    stages,
    totalOpenCents: open.reduce((sum, s) => sum + s.amountCents, 0),
    totalWeightedCents: open.reduce((sum, s) => sum + s.weightedAmountCents, 0),
    winRate: winRate(deals),
    quota: computeQuotaProgress(deals, quotaCents, now),
  };
}
