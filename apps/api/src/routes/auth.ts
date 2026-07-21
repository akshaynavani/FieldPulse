import { Router } from "express";
import type { LoginRequest, LoginResponse, SessionListResponse } from "@fieldpulse/contracts";
import { LoginRequestSchema } from "@fieldpulse/contracts";
import { HttpError, asyncHandler } from "../errors.js";
import { currentUser, requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { DUMMY_HASH, verifyPassword } from "../services/passwords.js";
import type { Deps } from "./deps.js";

export function authRouter({ repo, sessions }: Deps): Router {
  const router = Router();
  const auth = requireAuth(sessions);

  router.post(
    "/login",
    validateBody(LoginRequestSchema),
    asyncHandler(async (req, res) => {
      const { email, password, deviceLabel } = req.body as LoginRequest;
      const record = await repo.findUserByEmail(email);
      // Always run scrypt so response time does not reveal whether the email exists.
      const ok = await verifyPassword(password, record?.passwordHash ?? DUMMY_HASH);
      if (!record || !ok) throw new HttpError("unauthorized", "Invalid email or password");

      const { passwordHash: _ph, ...user } = record;
      const label = deviceLabel ?? req.header("user-agent")?.slice(0, 80) ?? null;
      const { token, session } = await sessions.create(user.id, label);
      const body: LoginResponse = { token, expiresAt: session.expiresAt.toISOString(), user };
      res.status(200).json(body);
    }),
  );

  router.post(
    "/logout",
    auth,
    asyncHandler(async (req, res) => {
      await sessions.revoke(req.auth!.sessionId, req.auth!.user.id);
      res.status(204).end();
    }),
  );

  router.get("/me", auth, (req, res) => {
    res.json(currentUser(req));
  });

  router.get(
    "/sessions",
    auth,
    asyncHandler(async (req, res) => {
      const list = await sessions.list(req.auth!.user.id);
      const body: SessionListResponse = {
        sessions: list.map((s) => ({
          id: s.id,
          deviceLabel: s.deviceLabel,
          createdAt: s.createdAt.toISOString(),
          lastSeenAt: s.lastSeenAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          current: s.id === req.auth!.sessionId,
        })),
      };
      res.json(body);
    }),
  );

  router.delete(
    "/sessions/:id",
    auth,
    asyncHandler(async (req, res) => {
      const removed = await sessions.revoke(req.params.id!, req.auth!.user.id);
      if (!removed) throw new HttpError("not_found", "Session not found");
      res.status(204).end();
    }),
  );

  return router;
}
