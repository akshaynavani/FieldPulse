import { z } from "zod";
import { IdSchema, IsoDateTimeSchema, LatLngSchema } from "./common.js";

export const VisitOutcomeSchema = z.enum([
  "productive",
  "follow_up_needed",
  "no_decision_maker",
  "rescheduled",
  "not_interested",
]);
export type VisitOutcome = z.infer<typeof VisitOutcomeSchema>;

export const VisitSchema = z.object({
  id: IdSchema,
  accountId: IdSchema,
  repId: IdSchema,
  scheduledAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema.nullable(),
  outcome: VisitOutcomeSchema.nullable(),
  notes: z.string().max(5000),
  followUpAt: IsoDateTimeSchema.nullable(),
  /** Where the rep actually checked in, captured from the device GPS. */
  checkInLocation: LatLngSchema.nullable(),
});
export type Visit = z.infer<typeof VisitSchema>;

export const ScheduleVisitSchema = z.object({
  accountId: IdSchema,
  scheduledAt: IsoDateTimeSchema,
  notes: z.string().max(5000).default(""),
});
export type ScheduleVisit = z.infer<typeof ScheduleVisitSchema>;

export const CompleteVisitSchema = z
  .object({
    completedAt: IsoDateTimeSchema,
    outcome: VisitOutcomeSchema,
    notes: z.string().max(5000).default(""),
    followUpAt: IsoDateTimeSchema.nullable().default(null),
    checkInLocation: LatLngSchema.nullable().default(null),
  })
  .refine((v) => v.outcome !== "follow_up_needed" || v.followUpAt !== null, {
    message: "followUpAt is required when outcome is follow_up_needed",
    path: ["followUpAt"],
  })
  .refine((v) => v.followUpAt === null || v.followUpAt > v.completedAt, {
    message: "followUpAt must be after completedAt",
    path: ["followUpAt"],
  });
export type CompleteVisit = z.infer<typeof CompleteVisitSchema>;

export const VisitListQuerySchema = z.object({
  from: IsoDateTimeSchema.optional(),
  to: IsoDateTimeSchema.optional(),
  accountId: IdSchema.optional(),
  status: z.enum(["scheduled", "completed", "all"]).default("all"),
});
export type VisitListQuery = z.infer<typeof VisitListQuerySchema>;

export const VisitListResponseSchema = z.object({ visits: z.array(VisitSchema) });
export type VisitListResponse = z.infer<typeof VisitListResponseSchema>;
