import { z } from "zod";
import { IdSchema, IsoDateTimeSchema, MoneyCentsSchema } from "./common.js";

export const UserRoleSchema = z.enum(["rep", "manager"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  name: z.string().min(1),
  role: UserRoleSchema,
  territory: z.string().min(1),
  /** Quarterly closed-won target in cents. */
  quarterlyQuotaCents: MoneyCentsSchema,
});
export type User = z.infer<typeof UserSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  /** Free-form label shown in the session list, e.g. "iPhone 15" or "Chrome on macOS". */
  deviceLabel: z.string().max(80).optional(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  token: z.string().min(32),
  expiresAt: IsoDateTimeSchema,
  user: UserSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const SessionSchema = z.object({
  id: IdSchema,
  deviceLabel: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  lastSeenAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
  current: z.boolean(),
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionListResponseSchema = z.object({ sessions: z.array(SessionSchema) });
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>;
