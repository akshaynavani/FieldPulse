import { z } from "zod";
import {
  IdSchema,
  IsoDateTimeSchema,
  LatLngSchema,
  PaginationQuerySchema,
  paginated,
} from "./common.js";

export const AccountTierSchema = z.enum(["A", "B", "C"]);
export type AccountTier = z.infer<typeof AccountTierSchema>;

export const ContactSchema = z.object({
  id: IdSchema,
  accountId: IdSchema,
  name: z.string().min(1),
  title: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const AccountSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(200),
  industry: z.string().min(1),
  tier: AccountTierSchema,
  address: z.string().min(1),
  location: LatLngSchema,
  ownerId: IdSchema,
  lastVisitAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type Account = z.infer<typeof AccountSchema>;

export const AccountDetailSchema = AccountSchema.extend({
  contacts: z.array(ContactSchema),
});
export type AccountDetail = z.infer<typeof AccountDetailSchema>;

export const CreateAccountSchema = AccountSchema.pick({
  name: true,
  industry: true,
  tier: true,
  address: true,
  location: true,
});
export type CreateAccount = z.infer<typeof CreateAccountSchema>;

export const UpdateAccountSchema = CreateAccountSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  "At least one field must be provided",
);
export type UpdateAccount = z.infer<typeof UpdateAccountSchema>;

export const CreateContactSchema = ContactSchema.omit({ id: true, accountId: true }).extend({
  title: z.string().nullable().default(null),
  email: z.string().email().nullable().default(null),
  phone: z.string().nullable().default(null),
});
export type CreateContact = z.infer<typeof CreateContactSchema>;

export const AccountListQuerySchema = PaginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  tier: AccountTierSchema.optional(),
});
export type AccountListQuery = z.infer<typeof AccountListQuerySchema>;

export const AccountListResponseSchema = paginated(AccountSchema);
export type AccountListResponse = z.infer<typeof AccountListResponseSchema>;
