import { randomUUID } from "node:crypto";
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
import type {
  DealPatch,
  Repository,
  Scope,
  SessionRecord,
  StoredResponse,
  UserRecord,
} from "./types.js";

/**
 * In-memory Repository with the same semantics as PgRepository. Used by the API
 * test-suite so route tests run without a database, and handy for local demos.
 */
export class MemoryRepository implements Repository {
  users = new Map<string, UserRecord>();
  sessions = new Map<string, SessionRecord>();
  accounts = new Map<string, Account>();
  contacts = new Map<string, Contact>();
  visits = new Map<string, Visit>();
  deals = new Map<string, Deal>();
  idempotency = new Map<string, StoredResponse>();

  constructor(private readonly clock: () => Date = () => new Date()) {}

  private owns(scope: Scope, ownerId: string) {
    return !scope.ownerId || scope.ownerId === ownerId;
  }

  private stripUser({ passwordHash: _p, ...user }: UserRecord): User {
    return user;
  }

  // users
  async findUserByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email.toLowerCase()) ?? null;
  }
  async findUserById(id: string) {
    const u = this.users.get(id);
    return u ? this.stripUser(u) : null;
  }
  async createUser(u: Omit<UserRecord, "id">) {
    const rec = { ...u, email: u.email.toLowerCase(), id: randomUUID() };
    this.users.set(rec.id, rec);
    return this.stripUser(rec);
  }

  // sessions
  async createSession(s: Omit<SessionRecord, "id" | "createdAt" | "lastSeenAt">) {
    const now = this.clock();
    const rec: SessionRecord = { ...s, id: randomUUID(), createdAt: now, lastSeenAt: now };
    this.sessions.set(rec.id, rec);
    return rec;
  }
  async findSessionByTokenHash(tokenHash: string) {
    return [...this.sessions.values()].find((s) => s.tokenHash === tokenHash) ?? null;
  }
  async touchSession(id: string, lastSeenAt: Date, expiresAt: Date) {
    const s = this.sessions.get(id);
    if (s) Object.assign(s, { lastSeenAt, expiresAt });
  }
  async listSessions(userId: string, now: Date) {
    return [...this.sessions.values()]
      .filter((s) => s.userId === userId && s.expiresAt > now)
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
  }
  async deleteSession(id: string, userId: string) {
    const s = this.sessions.get(id);
    if (!s || s.userId !== userId) return false;
    return this.sessions.delete(id);
  }
  async deleteExpiredSessions(now: Date) {
    let n = 0;
    for (const [id, s] of this.sessions) {
      if (s.expiresAt <= now) {
        this.sessions.delete(id);
        n++;
      }
    }
    return n;
  }

  // accounts
  async listAccounts(scope: Scope, q: AccountListQuery) {
    const term = q.search?.toLowerCase();
    const all = [...this.accounts.values()]
      .filter((a) => this.owns(scope, a.ownerId))
      .filter((a) => !q.tier || a.tier === q.tier)
      .filter(
        (a) => !term || a.name.toLowerCase().includes(term) || a.industry.toLowerCase().includes(term),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    const start = (q.page - 1) * q.pageSize;
    return { items: all.slice(start, start + q.pageSize), total: all.length };
  }
  async getAccount(scope: Scope, id: string) {
    const a = this.accounts.get(id);
    return a && this.owns(scope, a.ownerId) ? a : null;
  }
  async createAccount(ownerId: string, d: CreateAccount) {
    const a: Account = {
      ...d,
      id: randomUUID(),
      ownerId,
      lastVisitAt: null,
      createdAt: this.clock().toISOString(),
    };
    this.accounts.set(a.id, a);
    return a;
  }
  async updateAccount(scope: Scope, id: string, patch: UpdateAccount) {
    const a = await this.getAccount(scope, id);
    if (!a) return null;
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const updated = { ...a, ...defined };
    this.accounts.set(id, updated);
    return updated;
  }
  async listContacts(accountId: string) {
    return [...this.contacts.values()]
      .filter((c) => c.accountId === accountId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async addContact(accountId: string, d: CreateContact) {
    const c: Contact = { ...d, id: randomUUID(), accountId };
    this.contacts.set(c.id, c);
    return c;
  }

  // visits
  async listVisits(scope: Scope, q: VisitListQuery) {
    return [...this.visits.values()]
      .filter((v) => this.owns(scope, v.repId))
      .filter((v) => !q.accountId || v.accountId === q.accountId)
      .filter((v) => !q.from || Date.parse(v.scheduledAt) >= Date.parse(q.from))
      .filter((v) => !q.to || Date.parse(v.scheduledAt) < Date.parse(q.to))
      .filter((v) =>
        q.status === "scheduled"
          ? v.completedAt === null
          : q.status === "completed"
            ? v.completedAt !== null
            : true,
      )
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }
  async getVisit(scope: Scope, id: string) {
    const v = this.visits.get(id);
    return v && this.owns(scope, v.repId) ? v : null;
  }
  async scheduleVisit(repId: string, d: ScheduleVisit) {
    const v: Visit = {
      id: randomUUID(),
      accountId: d.accountId,
      repId,
      scheduledAt: new Date(d.scheduledAt).toISOString(),
      completedAt: null,
      outcome: null,
      notes: d.notes,
      followUpAt: null,
      checkInLocation: null,
    };
    this.visits.set(v.id, v);
    return v;
  }
  async completeVisit(id: string, d: CompleteVisit) {
    const v = this.visits.get(id)!;
    const updated: Visit = {
      ...v,
      completedAt: new Date(d.completedAt).toISOString(),
      outcome: d.outcome,
      notes: d.notes,
      followUpAt: d.followUpAt ? new Date(d.followUpAt).toISOString() : null,
      checkInLocation: d.checkInLocation,
    };
    this.visits.set(id, updated);
    const account = this.accounts.get(v.accountId);
    if (account && (!account.lastVisitAt || account.lastVisitAt < updated.completedAt!)) {
      account.lastVisitAt = updated.completedAt;
    }
    return updated;
  }

  // deals
  async listDeals(scope: Scope, q: DealListQuery) {
    return [...this.deals.values()]
      .filter((d) => this.owns(scope, d.ownerId))
      .filter((d) => !q.stage || d.stage === q.stage)
      .filter((d) => !q.accountId || d.accountId === q.accountId)
      .filter((d) => q.open === undefined || OPEN_STAGES.includes(d.stage) === q.open)
      .sort((a, b) => a.expectedCloseDate.localeCompare(b.expectedCloseDate));
  }
  async getDeal(scope: Scope, id: string) {
    const d = this.deals.get(id);
    return d && this.owns(scope, d.ownerId) ? d : null;
  }
  async createDeal(ownerId: string, data: CreateDeal) {
    const now = this.clock().toISOString();
    const d: Deal = {
      ...data,
      id: randomUUID(),
      ownerId,
      stage: "prospecting",
      lostReason: null,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.deals.set(d.id, d);
    return d;
  }
  async updateDeal(id: string, patch: DealPatch, expectedUpdatedAt?: string) {
    const d = this.deals.get(id);
    if (!d) return "conflict" as const;
    if (expectedUpdatedAt && Date.parse(expectedUpdatedAt) !== Date.parse(d.updatedAt)) {
      return "conflict" as const;
    }
    const updated: Deal = {
      ...d,
      stage: patch.stage,
      lostReason: patch.lostReason,
      closedAt: patch.closedAt ? patch.closedAt.toISOString() : null,
      updatedAt: this.clock().toISOString(),
    };
    this.deals.set(id, updated);
    return updated;
  }

  // idempotency
  async getIdempotentResponse(userId: string, key: string) {
    return this.idempotency.get(`${userId}:${key}`) ?? null;
  }
  async saveIdempotentResponse(userId: string, key: string, res: StoredResponse) {
    const k = `${userId}:${key}`;
    if (!this.idempotency.has(k)) this.idempotency.set(k, res);
  }
}
