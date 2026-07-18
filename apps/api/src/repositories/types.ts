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
  DealStage,
  ScheduleVisit,
  UpdateAccount,
  User,
  Visit,
  VisitListQuery,
} from "@fieldpulse/contracts";

export interface UserRecord extends User {
  passwordHash: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  deviceLabel: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

/**
 * Data scope for a request. Reps see only what they own; managers see everything
 * (ownerId undefined).
 */
export interface Scope {
  ownerId?: string;
}

export interface DealPatch {
  stage: DealStage;
  lostReason: string | null;
  closedAt: Date | null;
}

export interface StoredResponse {
  statusCode: number;
  body: unknown;
}

export interface Repository {
  // users
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(user: Omit<UserRecord, "id">): Promise<User>;

  // sessions
  createSession(s: Omit<SessionRecord, "id" | "createdAt" | "lastSeenAt">): Promise<SessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  touchSession(id: string, lastSeenAt: Date, expiresAt: Date): Promise<void>;
  listSessions(userId: string, now: Date): Promise<SessionRecord[]>;
  deleteSession(id: string, userId: string): Promise<boolean>;
  deleteExpiredSessions(now: Date): Promise<number>;

  // accounts
  listAccounts(scope: Scope, q: AccountListQuery): Promise<{ items: Account[]; total: number }>;
  getAccount(scope: Scope, id: string): Promise<Account | null>;
  createAccount(ownerId: string, data: CreateAccount): Promise<Account>;
  updateAccount(scope: Scope, id: string, patch: UpdateAccount): Promise<Account | null>;
  listContacts(accountId: string): Promise<Contact[]>;
  addContact(accountId: string, data: CreateContact): Promise<Contact>;

  // visits
  listVisits(scope: Scope, q: VisitListQuery): Promise<Visit[]>;
  getVisit(scope: Scope, id: string): Promise<Visit | null>;
  scheduleVisit(repId: string, data: ScheduleVisit): Promise<Visit>;
  /** Marks the visit complete and bumps the account's last_visit_at atomically. */
  completeVisit(id: string, data: CompleteVisit): Promise<Visit>;

  // deals
  listDeals(scope: Scope, q: DealListQuery): Promise<Deal[]>;
  getDeal(scope: Scope, id: string): Promise<Deal | null>;
  createDeal(ownerId: string, data: CreateDeal): Promise<Deal>;
  /**
   * Applies a stage change. When expectedUpdatedAt is given and does not match,
   * returns "conflict" without writing.
   */
  updateDeal(id: string, patch: DealPatch, expectedUpdatedAt?: string): Promise<Deal | "conflict">;

  // idempotency
  getIdempotentResponse(userId: string, key: string): Promise<StoredResponse | null>;
  saveIdempotentResponse(userId: string, key: string, res: StoredResponse): Promise<void>;
}
