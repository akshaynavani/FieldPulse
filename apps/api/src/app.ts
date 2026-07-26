import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";
import { HttpError, errorHandler } from "./errors.js";
import { requireAuth } from "./middleware/auth.js";
import { idempotency } from "./middleware/idempotency.js";
import type { Repository } from "./repositories/types.js";
import { accountsRouter } from "./routes/accounts.js";
import { authRouter } from "./routes/auth.js";
import { dealsRouter } from "./routes/deals.js";
import { pipelineRouter } from "./routes/pipeline.js";
import { visitsRouter } from "./routes/visits.js";
import { SessionService } from "./services/sessions.js";

export interface AppOptions {
  repo: Repository;
  sessionTtlHours?: number;
  corsOrigins?: string[];
  logger?: Logger;
  now?: () => Date;
  /** Optional readiness probe, e.g. `SELECT 1` against Postgres. */
  healthCheck?: () => Promise<void>;
}

export function createApp(opts: AppOptions): Express {
  const now = opts.now ?? (() => new Date());
  const sessions = new SessionService(opts.repo, { ttlHours: opts.sessionTtlHours ?? 336, now });
  const deps = { repo: opts.repo, sessions, now };

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: opts.corsOrigins ?? true,
      allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
      exposedHeaders: ["Idempotent-Replayed"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  if (opts.logger) {
    app.use(
      pinoHttp({
        logger: opts.logger,
        redact: ["req.headers.authorization", "req.headers.cookie"],
      }),
    );
  }

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/readyz", async (_req, res) => {
    try {
      await opts.healthCheck?.();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.use("/auth", authRouter(deps));

  const authed = express.Router();
  authed.use(requireAuth(sessions), idempotency(opts.repo));
  authed.use("/accounts", accountsRouter(deps));
  authed.use("/visits", visitsRouter(deps));
  authed.use("/deals", dealsRouter(deps));
  authed.use("/pipeline", pipelineRouter(deps));
  app.use(authed);

  app.use((_req, _res, next) => next(new HttpError("not_found", "Route not found")));
  app.use(errorHandler);

  return app;
}
