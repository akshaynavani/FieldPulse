import { z } from "zod";
import {
  CurrencySchema,
  IdSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  MoneyCentsSchema,
} from "./common.js";

export const DEAL_STAGES = [
  "prospecting",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

export const DealStageSchema = z.enum(DEAL_STAGES);
export type DealStage = z.infer<typeof DealStageSchema>;

export const OPEN_STAGES: readonly DealStage[] = [
  "prospecting",
  "qualified",
  "proposal",
  "negotiation",
];

export const DealSchema = z.object({
  id: IdSchema,
  accountId: IdSchema,
  ownerId: IdSchema,
  title: z.string().min(1).max(200),
  amountCents: MoneyCentsSchema,
  currency: CurrencySchema,
  stage: DealStageSchema,
  expectedCloseDate: IsoDateSchema,
  lostReason: z.string().nullable(),
  closedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Deal = z.infer<typeof DealSchema>;

export const CreateDealSchema = z.object({
  accountId: IdSchema,
  title: z.string().trim().min(1).max(200),
  amountCents: MoneyCentsSchema,
  currency: CurrencySchema.default("USD"),
  expectedCloseDate: IsoDateSchema,
});
export type CreateDeal = z.infer<typeof CreateDealSchema>;

export const UpdateDealStageSchema = z
  .object({
    stage: DealStageSchema,
    lostReason: z.string().trim().min(3).max(500).optional(),
    /** Optimistic concurrency guard: the updatedAt the client last saw. */
    expectedUpdatedAt: IsoDateTimeSchema.optional(),
  })
  .refine((v) => v.stage !== "closed_lost" || !!v.lostReason, {
    message: "lostReason is required when closing a deal as lost",
    path: ["lostReason"],
  });
export type UpdateDealStage = z.infer<typeof UpdateDealStageSchema>;

export const DealListQuerySchema = z.object({
  stage: DealStageSchema.optional(),
  accountId: IdSchema.optional(),
  open: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});
export type DealListQuery = z.infer<typeof DealListQuerySchema>;

export const DealListResponseSchema = z.object({ deals: z.array(DealSchema) });
export type DealListResponse = z.infer<typeof DealListResponseSchema>;
