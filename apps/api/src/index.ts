import { pino } from "pino";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db.js";
import { PgRepository } from "./repositories/pg.js";
import { SessionService } from "./services/sessions.js";

const config = loadConfig();
const logger = pino({ level: config.LOG_LEVEL });

const pool = createPool(config.DATABASE_URL, config.DATABASE_SSL);
const repo = new PgRepository(pool);

const app = createApp({
  repo,
  logger,
  sessionTtlHours: config.SESSION_TTL_HOURS,
  corsOrigins: config.CORS_ORIGINS,
  healthCheck: async () => {
    await pool.query("SELECT 1");
  },
});

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "FieldPulse API listening");
});

// Periodically purge expired sessions so the table does not grow unbounded.
const sessions = new SessionService(repo, { ttlHours: config.SESSION_TTL_HOURS });
const purge = setInterval(
  () => {
    sessions
      .purgeExpired()
      .then((n) => n > 0 && logger.info({ purged: n }, "purged expired sessions"))
      .catch((err) => logger.error({ err }, "session purge failed"));
  },
  60 * 60 * 1000,
);
purge.unref();

function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  clearInterval(purge);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
