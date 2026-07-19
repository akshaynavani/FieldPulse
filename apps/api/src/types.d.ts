import type { User } from "@fieldpulse/contracts";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      auth?: { user: User; sessionId: string };
      /** Set by validate(): parsed, typed request query. */
      validQuery?: unknown;
    }
  }
}

export {};
