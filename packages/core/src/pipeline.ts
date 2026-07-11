import type { Deal, DealStage, StageSummary } from "@fieldpulse/contracts";
import { DEAL_STAGES, OPEN_STAGES } from "@fieldpulse/contracts";

/** Default win probability per stage, used for weighted pipeline. */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  prospecting: 0.1,
  qualified: 0.25,
  proposal: 0.5,
  negotiation: 0.75,
  closed_won: 1,
  closed_lost: 0,
};

/**
 * Allowed stage moves. Deals may advance one or more stages, step back one stage,
 * or close from any open stage. Closed deals can only be reopened to "negotiation".
 */
export function canTransition(from: DealStage, to: DealStage): boolean {
  if (from === to) return false;
  if (from === "closed_won" || from === "closed_lost") return to === "negotiation";
  if (to === "closed_won" || to === "closed_lost") return true;
  const fromIdx = OPEN_STAGES.indexOf(from);
  const toIdx = OPEN_STAGES.indexOf(to);
  return toIdx > fromIdx || toIdx === fromIdx - 1;
}

export function allowedNextStages(from: DealStage): DealStage[] {
  return DEAL_STAGES.filter((to) => canTransition(from, to));
}

export function isOpen(stage: DealStage): boolean {
  return OPEN_STAGES.includes(stage);
}

export function weightedAmount(deal: Pick<Deal, "amountCents" | "stage">): number {
  return Math.round(deal.amountCents * STAGE_PROBABILITY[deal.stage]);
}

export function summarizeStages(deals: readonly Deal[]): StageSummary[] {
  return DEAL_STAGES.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage);
    return {
      stage,
      count: inStage.length,
      amountCents: inStage.reduce((sum, d) => sum + d.amountCents, 0),
      weightedAmountCents: inStage.reduce((sum, d) => sum + weightedAmount(d), 0),
    };
  });
}

/** Won / (won + lost); null when nothing has closed yet. */
export function winRate(deals: readonly Deal[]): number | null {
  const won = deals.filter((d) => d.stage === "closed_won").length;
  const lost = deals.filter((d) => d.stage === "closed_lost").length;
  return won + lost === 0 ? null : won / (won + lost);
}

/** Group deals by stage for a kanban-style board, preserving stage order. */
export function groupByStage(deals: readonly Deal[]): Record<DealStage, Deal[]> {
  const board = Object.fromEntries(DEAL_STAGES.map((s) => [s, [] as Deal[]])) as Record<
    DealStage,
    Deal[]
  >;
  for (const deal of deals) board[deal.stage].push(deal);
  for (const stage of DEAL_STAGES) {
    board[stage].sort((a, b) => a.expectedCloseDate.localeCompare(b.expectedCloseDate));
  }
  return board;
}
