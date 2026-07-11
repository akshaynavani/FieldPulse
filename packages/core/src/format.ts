import type { Currency, DealStage, VisitOutcome } from "@fieldpulse/contracts";

export function formatMoney(cents: number, currency: Currency = "USD", compact = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(cents / 100);
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export const STAGE_LABELS: Record<DealStage, string> = {
  prospecting: "Prospecting",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};

export const OUTCOME_LABELS: Record<VisitOutcome, string> = {
  productive: "Productive",
  follow_up_needed: "Follow-up needed",
  no_decision_maker: "Decision maker absent",
  rescheduled: "Rescheduled",
  not_interested: "Not interested",
};

/** "today", "tomorrow", "in 3 days", "2 days ago" relative to `now` by UTC day. */
export function relativeDay(iso: string, now: Date = new Date()): string {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = Math.round((day(new Date(iso)) - day(now)) / 86_400_000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}
