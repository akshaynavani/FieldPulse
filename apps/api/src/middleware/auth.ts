import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { User } from "@fieldpulse/contracts";
import { HttpError, asyncHandler } from "../errors.js";
import type { Scope } from "../repositories/types.js";
import type { SessionService } from "../services/sessions.js";

export function bearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export function requireAuth(sessions: SessionService): RequestHandler {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const token = bearerToken(req);
    if (!token) throw new HttpError("unauthorized", "Missing bearer token");
    const resolved = await sessions.resolve(token);
    if (!resolved) throw new HttpError("unauthorized", "Session is invalid or has expired");
    req.auth = { user: resolved.user, sessionId: resolved.session.id };
    next();
  });
}

/** Authenticated user; only call after requireAuth. */
export function currentUser(req: Request): User {
  if (!req.auth) throw new HttpError("unauthorized", "Not authenticated");
  return req.auth.user;
}

/** Reps are limited to their own records; managers see the whole team. */
export function scopeFor(req: Request): Scope {
  const user = currentUser(req);
  return user.role === "manager" ? {} : { ownerId: user.id };
}
