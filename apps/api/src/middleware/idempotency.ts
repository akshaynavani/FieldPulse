import type { RequestHandler } from "express";
import { HttpError, asyncHandler } from "../errors.js";
import type { Repository } from "../repositories/types.js";

/**
 * Honour the Idempotency-Key header on mutating requests. The offline queue on mobile
 * retries mutations until it sees a response; if the first attempt actually landed,
 * replaying it must not apply the change twice. Successful (2xx) responses are stored
 * per user+key and replayed verbatim.
 */
export function idempotency(repo: Repository): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    const key = req.header("idempotency-key");
    if (!key || !req.auth) return next();
    if (key.length > 200) throw new HttpError("bad_request", "Idempotency-Key is too long");

    const userId = req.auth.user.id;
    const stored = await repo.getIdempotentResponse(userId, key);
    if (stored) {
      res.setHeader("Idempotent-Replayed", "true");
      if (stored.body === null) return res.status(stored.statusCode).end();
      return res.status(stored.statusCode).json(stored.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        repo
          .saveIdempotentResponse(userId, key, { statusCode: res.statusCode, body })
          .catch((err) => req.log?.warn({ err }, "failed to store idempotent response"));
      }
      return originalJson(body);
    };
    next();
  });
}
