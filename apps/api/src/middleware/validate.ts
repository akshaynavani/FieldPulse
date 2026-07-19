import type { RequestHandler } from "express";
import type { z } from "zod";
import { HttpError } from "../errors.js";

function issues(err: z.ZodError) {
  return err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/** Parse req.body with the contract schema, replacing it with the parsed output. */
export function validateBody(schema: z.ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) return next(new HttpError("bad_request", "Invalid request body", issues(parsed.error)));
    req.body = parsed.data;
    next();
  };
}

/** Parse req.query; the typed result lives on req.validQuery (req.query is read-only-ish). */
export function validateQuery(schema: z.ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return next(new HttpError("bad_request", "Invalid query string", issues(parsed.error)));
    req.validQuery = parsed.data;
    next();
  };
}

export function validQuery<T>(req: { validQuery?: unknown }): T {
  return req.validQuery as T;
}
