import { createHash, randomBytes } from "node:crypto";
import type { User } from "@fieldpulse/contracts";
import type { Repository, SessionRecord } from "../repositories/types.js";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionServiceOptions {
  ttlHours: number;
  now?: () => Date;
}

/**
 * Postgres-backed opaque sessions. Tokens are 256-bit random values handed to the
 * client once; only their SHA-256 is persisted. Expiry slides forward on use, but
 * the write is throttled so every request does not hit the sessions table.
 */
export class SessionService {
  private readonly ttlMs: number;
  private readonly now: () => Date;
  private static readonly TOUCH_INTERVAL_MS = 5 * 60_000;

  constructor(
    private readonly repo: Repository,
    opts: SessionServiceOptions,
  ) {
    this.ttlMs = opts.ttlHours * 3_600_000;
    this.now = opts.now ?? (() => new Date());
  }

  async create(userId: string, deviceLabel: string | null) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.now().getTime() + this.ttlMs);
    const session = await this.repo.createSession({
      userId,
      tokenHash: hashToken(token),
      deviceLabel,
      expiresAt,
    });
    return { token, session };
  }

  /** Resolve a bearer token to its session and user, or null if invalid/expired. */
  async resolve(token: string): Promise<{ session: SessionRecord; user: User } | null> {
    const session = await this.repo.findSessionByTokenHash(hashToken(token));
    const now = this.now();
    if (!session) return null;
    if (session.expiresAt <= now) {
      await this.repo.deleteSession(session.id, session.userId);
      return null;
    }
    const user = await this.repo.findUserById(session.userId);
    if (!user) return null;

    if (now.getTime() - session.lastSeenAt.getTime() > SessionService.TOUCH_INTERVAL_MS) {
      const expiresAt = new Date(now.getTime() + this.ttlMs);
      await this.repo.touchSession(session.id, now, expiresAt);
      session.lastSeenAt = now;
      session.expiresAt = expiresAt;
    }
    return { session, user };
  }

  revoke(sessionId: string, userId: string) {
    return this.repo.deleteSession(sessionId, userId);
  }

  list(userId: string) {
    return this.repo.listSessions(userId, this.now());
  }

  purgeExpired() {
    return this.repo.deleteExpiredSessions(this.now());
  }
}
