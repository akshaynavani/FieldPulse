import { z } from "zod";

export const IdSchema = z.string().uuid();
export type Id = z.infer<typeof IdSchema>;

/** ISO-8601 timestamp with offset, e.g. 2026-10-08T14:30:00.000Z */
export const IsoDateTimeSchema = z.string().datetime({ offset: true });

/** Calendar date, e.g. 2026-12-31 */
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** Monetary amounts are integer minor units (cents) to avoid float drift. */
export const MoneyCentsSchema = z.number().int().nonnegative();

export const CurrencySchema = z.enum(["USD", "EUR", "GBP", "INR", "CAD"]);
export type Currency = z.infer<typeof CurrencySchema>;

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLngSchema>;

/** Query-string numbers arrive as strings; coerce them. */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().nonnegative(),
  });
}
export type Paginated<T> = { items: T[]; page: number; pageSize: number; total: number };

export const ErrorCodeSchema = z.enum([
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "invalid_transition",
  "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    issues: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
