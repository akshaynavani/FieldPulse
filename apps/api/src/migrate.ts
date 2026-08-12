/**
 * Minimal forward-only migration runner. Applies every migrations/*.sql file not yet
 * recorded in schema_migrations, each inside its own transaction, in filename order.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createPool, withTransaction } from "./db.js";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

async function main() {
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL, config.DATABASE_SSL);
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    // Serialise concurrent deploys.
    await pool.query("SELECT pg_advisory_lock(727274)");

    const { rows } = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.name));
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(dir, file), "utf8");
      await withTransaction(pool, async (client) => {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      });
      console.info(`applied ${file}`);
      count++;
    }
    console.info(count === 0 ? "database is up to date" : `applied ${count} migration(s)`);
    await pool.query("SELECT pg_advisory_unlock(727274)");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
