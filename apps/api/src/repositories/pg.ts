import type {
  Account,
  AccountListQuery,
  CompleteVisit,
  Contact,
  CreateAccount,
  CreateContact,
  CreateDeal,
  Deal,
  DealListQuery,
  ScheduleVisit,
  UpdateAccount,
  User,
  Visit,
  VisitListQuery,
} from "@fieldpulse/contracts";
import { OPEN_STAGES } from "@fieldpulse/contracts";
import type { Pool } from "../db.js";
import { withTransaction } from "../db.js";
import type {
  DealPatch,
  Repository,
  Scope,
  SessionRecord,
  StoredResponse,
  UserRecord,
} from "./types.js";

type Row = Record<string, unknown>;

const iso = (v: unknown): string => (v as Date).toISOString();
const isoOrNull = (v: unknown): string | null => (v == null ? null : iso(v));

function toUser(r: Row): User {
  return {
    id: r.id as string,
    email: r.email as string,
    name: r.name as string,
    role: r.role as User["role"],
    territory: r.territory as string,
    quarterlyQuotaCents: r.quarterly_quota_cents as number,
  };
}

function toSession(r: Row): SessionRecord {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    tokenHash: r.token_hash as string,
    deviceLabel: (r.device_label as string | null) ?? null,
    createdAt: r.created_at as Date,
    lastSeenAt: r.last_seen_at as Date,
    expiresAt: r.expires_at as Date,
  };
}

function toAccount(r: Row): Account {
  return {
    id: r.id as string,
    name: r.name as string,
    industry: r.industry as string,
    tier: r.tier as Account["tier"],
    address: r.address as string,
    location: { lat: r.lat as number, lng: r.lng as number },
    ownerId: r.owner_id as string,
    lastVisitAt: isoOrNull(r.last_visit_at),
    createdAt: iso(r.created_at),
  };
}

function toContact(r: Row): Contact {
  return {
    id: r.id as string,
    accountId: r.account_id as string,
    name: r.name as string,
    title: (r.title as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
  };
}

function toVisit(r: Row): Visit {
  return {
    id: r.id as string,
    accountId: r.account_id as string,
    repId: r.rep_id as string,
    scheduledAt: iso(r.scheduled_at),
    completedAt: isoOrNull(r.completed_at),
    outcome: (r.outcome as Visit["outcome"]) ?? null,
    notes: r.notes as string,
    followUpAt: isoOrNull(r.follow_up_at),
    checkInLocation:
      r.check_in_lat == null ? null : { lat: r.check_in_lat as number, lng: r.check_in_lng as number },
  };
}

function toDeal(r: Row): Deal {
  return {
    id: r.id as string,
    accountId: r.account_id as string,
    ownerId: r.owner_id as string,
    title: r.title as string,
    amountCents: r.amount_cents as number,
    currency: r.currency as Deal["currency"],
    stage: r.stage as Deal["stage"],
    expectedCloseDate: r.expected_close_date as string,
    lostReason: (r.lost_reason as string | null) ?? null,
    closedAt: isoOrNull(r.closed_at),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/** Tiny helper to build parameterised WHERE clauses without string-concatenating values. */
class Where {
  private parts: string[] = [];
  readonly params: unknown[] = [];
  /** Every "?" in the fragment is bound to the same single value. */
  add(sqlWithPlaceholder: string, value: unknown) {
    this.params.push(value);
    this.parts.push(sqlWithPlaceholder.replaceAll("?", `$${this.params.length}`));
    return this;
  }
  raw(sql: string) {
    this.parts.push(sql);
    return this;
  }
  toString() {
    return this.parts.length ? `WHERE ${this.parts.join(" AND ")}` : "";
  }
}

export class PgRepository implements Repository {
  constructor(private readonly pool: Pool) {}

  // ---- users ---------------------------------------------------------------

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    const r = rows[0];
    return r ? { ...toUser(r), passwordHash: r.password_hash } : null;
  }

  async findUserById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async createUser(u: Omit<UserRecord, "id">): Promise<User> {
    const { rows } = await this.pool.query(
      `INSERT INTO users (email, name, role, territory, quarterly_quota_cents, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [u.email.toLowerCase(), u.name, u.role, u.territory, u.quarterlyQuotaCents, u.passwordHash],
    );
    return toUser(rows[0]);
  }

  // ---- sessions ------------------------------------------------------------

  async createSession(s: Omit<SessionRecord, "id" | "createdAt" | "lastSeenAt">): Promise<SessionRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO sessions (user_id, token_hash, device_label, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [s.userId, s.tokenHash, s.deviceLabel, s.expiresAt],
    );
    return toSession(rows[0]);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const { rows } = await this.pool.query("SELECT * FROM sessions WHERE token_hash = $1", [tokenHash]);
    return rows[0] ? toSession(rows[0]) : null;
  }

  async touchSession(id: string, lastSeenAt: Date, expiresAt: Date): Promise<void> {
    await this.pool.query("UPDATE sessions SET last_seen_at = $2, expires_at = $3 WHERE id = $1", [
      id,
      lastSeenAt,
      expiresAt,
    ]);
  }

  async listSessions(userId: string, now: Date): Promise<SessionRecord[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM sessions WHERE user_id = $1 AND expires_at > $2 ORDER BY last_seen_at DESC",
      [userId, now],
    );
    return rows.map(toSession);
  }

  async deleteSession(id: string, userId: string): Promise<boolean> {
    const res = await this.pool.query("DELETE FROM sessions WHERE id = $1 AND user_id = $2", [id, userId]);
    return (res.rowCount ?? 0) > 0;
  }

  async deleteExpiredSessions(now: Date): Promise<number> {
    const res = await this.pool.query("DELETE FROM sessions WHERE expires_at <= $1", [now]);
    return res.rowCount ?? 0;
  }

  // ---- accounts ------------------------------------------------------------

  async listAccounts(scope: Scope, q: AccountListQuery) {
    const where = new Where();
    if (scope.ownerId) where.add("owner_id = ?", scope.ownerId);
    if (q.tier) where.add("tier = ?", q.tier);
    if (q.search) {
      const pattern = `%${q.search.toLowerCase().replace(/[%_\\]/g, "\\$&")}%`;
      where.add("(lower(name) LIKE ? OR lower(industry) LIKE ?)", pattern);
    }

    const countRes = await this.pool.query(`SELECT count(*)::int AS total FROM accounts ${where}`, where.params);
    const offset = (q.page - 1) * q.pageSize;
    const { rows } = await this.pool.query(
      `SELECT * FROM accounts ${where} ORDER BY name ASC LIMIT ${q.pageSize} OFFSET ${offset}`,
      where.params,
    );
    return { items: rows.map(toAccount), total: countRes.rows[0].total as number };
  }

  async getAccount(scope: Scope, id: string): Promise<Account | null> {
    const where = new Where().add("id = ?", id);
    if (scope.ownerId) where.add("owner_id = ?", scope.ownerId);
    const { rows } = await this.pool.query(`SELECT * FROM accounts ${where}`, where.params);
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async createAccount(ownerId: string, d: CreateAccount): Promise<Account> {
    const { rows } = await this.pool.query(
      `INSERT INTO accounts (owner_id, name, industry, tier, address, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [ownerId, d.name, d.industry, d.tier, d.address, d.location.lat, d.location.lng],
    );
    return toAccount(rows[0]);
  }

  async updateAccount(scope: Scope, id: string, patch: UpdateAccount): Promise<Account | null> {
    const columns: Record<string, unknown> = {
      name: patch.name,
      industry: patch.industry,
      tier: patch.tier,
      address: patch.address,
      lat: patch.location?.lat,
      lng: patch.location?.lng,
    };
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [col, value] of Object.entries(columns)) {
      if (value === undefined) continue;
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    }
    params.push(id);
    let sql = `UPDATE accounts SET ${sets.join(", ")} WHERE id = $${params.length}`;
    if (scope.ownerId) {
      params.push(scope.ownerId);
      sql += ` AND owner_id = $${params.length}`;
    }
    const { rows } = await this.pool.query(`${sql} RETURNING *`, params);
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async listContacts(accountId: string): Promise<Contact[]> {
    const { rows } = await this.pool.query("SELECT * FROM contacts WHERE account_id = $1 ORDER BY name", [
      accountId,
    ]);
    return rows.map(toContact);
  }

  async addContact(accountId: string, d: CreateContact): Promise<Contact> {
    const { rows } = await this.pool.query(
      `INSERT INTO contacts (account_id, name, title, email, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [accountId, d.name, d.title, d.email, d.phone],
    );
    return toContact(rows[0]);
  }

  // ---- visits --------------------------------------------------------------

  async listVisits(scope: Scope, q: VisitListQuery): Promise<Visit[]> {
    const where = new Where();
    if (scope.ownerId) where.add("rep_id = ?", scope.ownerId);
    if (q.accountId) where.add("account_id = ?", q.accountId);
    if (q.from) where.add("scheduled_at >= ?", q.from);
    if (q.to) where.add("scheduled_at < ?", q.to);
    if (q.status === "scheduled") where.raw("completed_at IS NULL");
    if (q.status === "completed") where.raw("completed_at IS NOT NULL");
    const { rows } = await this.pool.query(
      `SELECT * FROM visits ${where} ORDER BY scheduled_at ASC LIMIT 500`,
      where.params,
    );
    return rows.map(toVisit);
  }

  async getVisit(scope: Scope, id: string): Promise<Visit | null> {
    const where = new Where().add("id = ?", id);
    if (scope.ownerId) where.add("rep_id = ?", scope.ownerId);
    const { rows } = await this.pool.query(`SELECT * FROM visits ${where}`, where.params);
    return rows[0] ? toVisit(rows[0]) : null;
  }

  async scheduleVisit(repId: string, d: ScheduleVisit): Promise<Visit> {
    const { rows } = await this.pool.query(
      `INSERT INTO visits (account_id, rep_id, scheduled_at, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [d.accountId, repId, d.scheduledAt, d.notes],
    );
    return toVisit(rows[0]);
  }

  async completeVisit(id: string, d: CompleteVisit): Promise<Visit> {
    return withTransaction(this.pool, async (client) => {
      const { rows } = await client.query(
        `UPDATE visits
           SET completed_at = $2, outcome = $3, notes = $4, follow_up_at = $5,
               check_in_lat = $6, check_in_lng = $7
         WHERE id = $1 RETURNING *`,
        [
          id,
          d.completedAt,
          d.outcome,
          d.notes,
          d.followUpAt,
          d.checkInLocation?.lat ?? null,
          d.checkInLocation?.lng ?? null,
        ],
      );
      const visit = toVisit(rows[0]);
      await client.query(
        `UPDATE accounts SET last_visit_at = GREATEST(COALESCE(last_visit_at, $2), $2) WHERE id = $1`,
        [visit.accountId, d.completedAt],
      );
      return visit;
    });
  }

  // ---- deals ---------------------------------------------------------------

  async listDeals(scope: Scope, q: DealListQuery): Promise<Deal[]> {
    const where = new Where();
    if (scope.ownerId) where.add("owner_id = ?", scope.ownerId);
    if (q.stage) where.add("stage = ?", q.stage);
    if (q.accountId) where.add("account_id = ?", q.accountId);
    if (q.open === true) where.add("stage = ANY(?)", OPEN_STAGES);
    if (q.open === false) where.add("NOT (stage = ANY(?))", OPEN_STAGES);
    const { rows } = await this.pool.query(
      `SELECT * FROM deals ${where} ORDER BY expected_close_date ASC, created_at ASC`,
      where.params,
    );
    return rows.map(toDeal);
  }

  async getDeal(scope: Scope, id: string): Promise<Deal | null> {
    const where = new Where().add("id = ?", id);
    if (scope.ownerId) where.add("owner_id = ?", scope.ownerId);
    const { rows } = await this.pool.query(`SELECT * FROM deals ${where}`, where.params);
    return rows[0] ? toDeal(rows[0]) : null;
  }

  async createDeal(ownerId: string, d: CreateDeal): Promise<Deal> {
    const { rows } = await this.pool.query(
      `INSERT INTO deals (account_id, owner_id, title, amount_cents, currency, stage, expected_close_date)
       VALUES ($1, $2, $3, $4, $5, 'prospecting', $6) RETURNING *`,
      [d.accountId, ownerId, d.title, d.amountCents, d.currency, d.expectedCloseDate],
    );
    return toDeal(rows[0]);
  }

  async updateDeal(id: string, patch: DealPatch, expectedUpdatedAt?: string): Promise<Deal | "conflict"> {
    const params: unknown[] = [id, patch.stage, patch.lostReason, patch.closedAt];
    let sql = `UPDATE deals SET stage = $2, lost_reason = $3, closed_at = $4, updated_at = now()
               WHERE id = $1`;
    if (expectedUpdatedAt) {
      params.push(expectedUpdatedAt);
      // Compare at millisecond precision since that is what the client saw.
      sql += ` AND date_trunc('milliseconds', updated_at) = $5::timestamptz`;
    }
    const { rows } = await this.pool.query(`${sql} RETURNING *`, params);
    return rows[0] ? toDeal(rows[0]) : "conflict";
  }

  // ---- idempotency ---------------------------------------------------------

  async getIdempotentResponse(userId: string, key: string): Promise<StoredResponse | null> {
    const { rows } = await this.pool.query(
      "SELECT status_code, response FROM idempotency_keys WHERE user_id = $1 AND key = $2",
      [userId, key],
    );
    return rows[0] ? { statusCode: rows[0].status_code, body: rows[0].response } : null;
  }

  async saveIdempotentResponse(userId: string, key: string, res: StoredResponse): Promise<void> {
    await this.pool.query(
      `INSERT INTO idempotency_keys (user_id, key, status_code, response)
       VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, key) DO NOTHING`,
      [userId, key, res.statusCode, JSON.stringify(res.body)],
    );
  }
}
