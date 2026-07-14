import type { ZodError } from "zod";
import {
  ErrorResponseSchema,
  buildPath,
  routes,
  type RouteBody,
  type RouteName,
  type RouteParams,
  type RouteQuery,
  type RouteResponse,
} from "@fieldpulse/contracts";
import { ApiError, ContractError, NetworkError } from "./errors.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientOptions {
  baseUrl: string;
  /** Returns the current session token, or null when logged out. */
  getToken?: () => string | null | Promise<string | null>;
  /** Called on any 401 so the app can clear its session and route to login. */
  onUnauthorized?: () => void;
  fetch?: FetchLike;
  timeoutMs?: number;
}

type HasKeys<T> = keyof T extends never ? false : true;

export type CallArgs<N extends RouteName> = (HasKeys<RouteParams<N>> extends true
  ? { params: RouteParams<N> }
  : { params?: undefined }) &
  ([RouteBody<N>] extends [never] ? { body?: undefined } : { body: RouteBody<N> }) &
  ([RouteQuery<N>] extends [never] ? { query?: undefined } : { query?: RouteQuery<N> }) & {
    idempotencyKey?: string;
    signal?: AbortSignal;
  };

function toIssues(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

function toQueryString(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export class FieldPulseClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(private readonly options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  /**
   * Call any route in the registry. The request body is validated before sending
   * (so bad input never leaves the device) and the response is parsed against the
   * contract before being returned.
   */
  async call<N extends RouteName>(name: N, args: CallArgs<N>): Promise<RouteResponse<N>> {
    const route = routes[name];
    const a = args as {
      params?: Record<string, string>;
      body?: unknown;
      query?: Record<string, unknown>;
      idempotencyKey?: string;
      signal?: AbortSignal;
    };

    let body: unknown = undefined;
    if ("body" in route && route.body) {
      const parsed = route.body.safeParse(a.body);
      if (!parsed.success) {
        throw new ApiError(0, "bad_request", "Request failed client-side validation", toIssues(parsed.error));
      }
      body = parsed.data;
    }

    const url = `${this.baseUrl}${buildPath(route.path, a.params)}${toQueryString(a.query)}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (a.idempotencyKey) headers["Idempotency-Key"] = a.idempotencyKey;
    if (route.auth) {
      const token = await this.options.getToken?.();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    a.signal?.addEventListener("abort", () => controller.abort());

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: route.method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw new NetworkError(`Could not reach FieldPulse API (${route.method} ${route.path})`, err);
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 204) {
      return route.response.parse(null) as RouteResponse<N>;
    }

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401) this.options.onUnauthorized?.();
      const parsedErr = ErrorResponseSchema.safeParse(json);
      if (parsedErr.success) {
        const { code, message, issues } = parsedErr.data.error;
        throw new ApiError(res.status, code, message, issues);
      }
      throw new ApiError(res.status, res.status >= 500 ? "internal" : "bad_request", res.statusText);
    }

    const parsed = route.response.safeParse(json);
    if (!parsed.success) throw new ContractError(name, toIssues(parsed.error));
    return parsed.data as RouteResponse<N>;
  }

  // Convenience wrappers for the most common calls.

  login(body: RouteBody<"login">) {
    return this.call("login", { body });
  }
  logout() {
    return this.call("logout", {});
  }
  me() {
    return this.call("me", {});
  }
  listAccounts(query: RouteQuery<"listAccounts"> = {}) {
    return this.call("listAccounts", { query });
  }
  getAccount(id: string) {
    return this.call("getAccount", { params: { id } });
  }
  listVisits(query: RouteQuery<"listVisits"> = {}) {
    return this.call("listVisits", { query });
  }
  completeVisit(id: string, body: RouteBody<"completeVisit">, idempotencyKey?: string) {
    return this.call("completeVisit", { params: { id }, body, idempotencyKey });
  }
  listDeals(query: RouteQuery<"listDeals"> = {}) {
    return this.call("listDeals", { query });
  }
  updateDealStage(id: string, body: RouteBody<"updateDealStage">, idempotencyKey?: string) {
    return this.call("updateDealStage", { params: { id }, body, idempotencyKey });
  }
  pipelineSummary() {
    return this.call("pipelineSummary", {});
  }
}
