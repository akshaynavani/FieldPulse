import { z } from "zod";
import {
  LoginRequestSchema,
  LoginResponseSchema,
  SessionListResponseSchema,
  UserSchema,
} from "./auth.js";
import {
  AccountDetailSchema,
  AccountListQuerySchema,
  AccountListResponseSchema,
  AccountSchema,
  ContactSchema,
  CreateAccountSchema,
  CreateContactSchema,
  UpdateAccountSchema,
} from "./accounts.js";
import {
  CompleteVisitSchema,
  ScheduleVisitSchema,
  VisitListQuerySchema,
  VisitListResponseSchema,
  VisitSchema,
} from "./visits.js";
import {
  CreateDealSchema,
  DealListQuerySchema,
  DealListResponseSchema,
  DealSchema,
  UpdateDealStageSchema,
} from "./deals.js";
import { PipelineSummarySchema } from "./pipeline.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface RouteDef {
  method: HttpMethod;
  path: string;
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  response: z.ZodTypeAny;
  auth: boolean;
}

const NoContent = z.null();

/**
 * Single registry of every endpoint. The API mounts handlers against these definitions
 * and the client derives its request/response types from them, so both sides agree.
 */
export const routes = {
  login: {
    method: "POST",
    path: "/auth/login",
    body: LoginRequestSchema,
    response: LoginResponseSchema,
    auth: false,
  },
  logout: { method: "POST", path: "/auth/logout", response: NoContent, auth: true },
  me: { method: "GET", path: "/auth/me", response: UserSchema, auth: true },
  listSessions: {
    method: "GET",
    path: "/auth/sessions",
    response: SessionListResponseSchema,
    auth: true,
  },
  revokeSession: {
    method: "DELETE",
    path: "/auth/sessions/:id",
    response: NoContent,
    auth: true,
  },

  listAccounts: {
    method: "GET",
    path: "/accounts",
    query: AccountListQuerySchema,
    response: AccountListResponseSchema,
    auth: true,
  },
  getAccount: { method: "GET", path: "/accounts/:id", response: AccountDetailSchema, auth: true },
  createAccount: {
    method: "POST",
    path: "/accounts",
    body: CreateAccountSchema,
    response: AccountSchema,
    auth: true,
  },
  updateAccount: {
    method: "PATCH",
    path: "/accounts/:id",
    body: UpdateAccountSchema,
    response: AccountSchema,
    auth: true,
  },
  addContact: {
    method: "POST",
    path: "/accounts/:id/contacts",
    body: CreateContactSchema,
    response: ContactSchema,
    auth: true,
  },

  listVisits: {
    method: "GET",
    path: "/visits",
    query: VisitListQuerySchema,
    response: VisitListResponseSchema,
    auth: true,
  },
  scheduleVisit: {
    method: "POST",
    path: "/visits",
    body: ScheduleVisitSchema,
    response: VisitSchema,
    auth: true,
  },
  completeVisit: {
    method: "POST",
    path: "/visits/:id/complete",
    body: CompleteVisitSchema,
    response: VisitSchema,
    auth: true,
  },

  listDeals: {
    method: "GET",
    path: "/deals",
    query: DealListQuerySchema,
    response: DealListResponseSchema,
    auth: true,
  },
  createDeal: {
    method: "POST",
    path: "/deals",
    body: CreateDealSchema,
    response: DealSchema,
    auth: true,
  },
  updateDealStage: {
    method: "PATCH",
    path: "/deals/:id/stage",
    body: UpdateDealStageSchema,
    response: DealSchema,
    auth: true,
  },

  pipelineSummary: {
    method: "GET",
    path: "/pipeline/summary",
    response: PipelineSummarySchema,
    auth: true,
  },
} as const satisfies Record<string, RouteDef>;

export type Routes = typeof routes;
export type RouteName = keyof Routes;

type Infer<T> = T extends z.ZodTypeAny ? z.input<T> : never;
type InferOut<T> = T extends z.ZodTypeAny ? z.output<T> : never;

/** Path params extracted from a template like "/accounts/:id/contacts". */
type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type RouteParams<N extends RouteName> = [ParamNames<Routes[N]["path"]>] extends [never]
  ? Record<string, never>
  : Record<ParamNames<Routes[N]["path"]>, string>;

export type RouteBody<N extends RouteName> = Routes[N] extends { body: infer B } ? Infer<B> : never;
export type RouteQuery<N extends RouteName> = Routes[N] extends { query: infer Q }
  ? Partial<Infer<Q>>
  : never;
export type RouteResponse<N extends RouteName> = InferOut<Routes[N]["response"]>;

/** Fill ":param" placeholders, URL-encoding each value. */
export function buildPath(template: string, params: Record<string, string> = {}): string {
  return template.replace(/:([A-Za-z_]+)/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`Missing path param "${key}" for ${template}`);
    return encodeURIComponent(value);
  });
}
