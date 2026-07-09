import { z } from "zod";
import { DealStageSchema } from "./deals.js";
import { IsoDateSchema, MoneyCentsSchema } from "./common.js";

export const StageSummarySchema = z.object({
  stage: DealStageSchema,
  count: z.number().int().nonnegative(),
  amountCents: MoneyCentsSchema,
  weightedAmountCents: MoneyCentsSchema,
});
export type StageSummary = z.infer<typeof StageSummarySchema>;

export const QuotaProgressSchema = z.object({
  quarterStart: IsoDateSchema,
  quarterEnd: IsoDateSchema,
  targetCents: MoneyCentsSchema,
  closedWonCents: MoneyCentsSchema,
  weightedOpenCents: MoneyCentsSchema,
  /** closedWon / target, 0..n (can exceed 1). */
  attainment: z.number().nonnegative(),
  /** (closedWon + weighted open closing this quarter) / target. */
  projectedAttainment: z.number().nonnegative(),
  daysRemaining: z.number().int().nonnegative(),
});
export type QuotaProgress = z.infer<typeof QuotaProgressSchema>;

export const PipelineSummarySchema = z.object({
  stages: z.array(StageSummarySchema),
  totalOpenCents: MoneyCentsSchema,
  totalWeightedCents: MoneyCentsSchema,
  winRate: z.number().min(0).max(1).nullable(),
  quota: QuotaProgressSchema,
});
export type PipelineSummary = z.infer<typeof PipelineSummarySchema>;
