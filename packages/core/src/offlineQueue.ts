/**
 * A persistent FIFO queue of mutations made while offline. Platform specifics are
 * injected: mobile passes an AsyncStorage adapter, web a localStorage adapter, tests
 * an in-memory map. The queue never talks to the network itself — `flush` hands each
 * mutation to an executor (normally the API client).
 */

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface QueuedMutation<P = unknown> {
  /** Client-generated id, sent as Idempotency-Key so retries never double-apply. */
  id: string;
  kind: string;
  payload: P;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface FlushResult {
  succeeded: number;
  failed: number;
  dropped: QueuedMutation[];
  remaining: number;
}

export interface OfflineQueueOptions {
  storageKey?: string;
  /** Drop a mutation after this many failed attempts. */
  maxAttempts?: number;
  /** Return false for errors that will never succeed (e.g. 4xx validation). */
  isRetryable?: (err: unknown) => boolean;
  now?: () => Date;
  generateId?: () => string;
}

function defaultId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class OfflineQueue {
  private readonly key: string;
  private readonly maxAttempts: number;
  private readonly isRetryable: (err: unknown) => boolean;
  private readonly now: () => Date;
  private readonly generateId: () => string;
  private flushing: Promise<FlushResult> | null = null;
  private listeners = new Set<(size: number) => void>();

  constructor(
    private readonly storage: KeyValueStorage,
    options: OfflineQueueOptions = {},
  ) {
    this.key = options.storageKey ?? "fieldpulse.offlineQueue";
    this.maxAttempts = options.maxAttempts ?? 5;
    this.isRetryable = options.isRetryable ?? (() => true);
    this.now = options.now ?? (() => new Date());
    this.generateId = options.generateId ?? defaultId;
  }

  async list(): Promise<QueuedMutation[]> {
    const raw = await this.storage.getItem(this.key);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
    } catch {
      return [];
    }
  }

  async size(): Promise<number> {
    return (await this.list()).length;
  }

  subscribe(listener: (size: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async save(items: QueuedMutation[]): Promise<void> {
    await this.storage.setItem(this.key, JSON.stringify(items));
    this.listeners.forEach((l) => l(items.length));
  }

  /**
   * Add a mutation. Pass `id` when the caller already tried the request live with an
   * idempotency key, so the replay reuses that key.
   */
  async enqueue<P>(kind: string, payload: P, id?: string): Promise<QueuedMutation<P>> {
    const mutation: QueuedMutation<P> = {
      id: id ?? this.generateId(),
      kind,
      payload,
      createdAt: this.now().toISOString(),
      attempts: 0,
    };
    const items = await this.list();
    items.push(mutation);
    await this.save(items);
    return mutation;
  }

  /**
   * Replay mutations in order. Stops at the first retryable failure so ordering is
   * preserved (e.g. "create deal" must land before "move deal stage").
   * Concurrent calls share the same in-flight flush.
   */
  flush(execute: (m: QueuedMutation) => Promise<void>): Promise<FlushResult> {
    if (!this.flushing) {
      this.flushing = this.doFlush(execute).finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async doFlush(execute: (m: QueuedMutation) => Promise<void>): Promise<FlushResult> {
    const items = await this.list();
    const dropped: QueuedMutation[] = [];
    let succeeded = 0;
    let failed = 0;

    while (items.length > 0) {
      const head = items[0]!;
      try {
        await execute(head);
        items.shift();
        succeeded++;
      } catch (err) {
        head.attempts += 1;
        head.lastError = err instanceof Error ? err.message : String(err);
        if (!this.isRetryable(err) || head.attempts >= this.maxAttempts) {
          dropped.push(items.shift()!);
          continue;
        }
        failed++;
        break;
      }
    }

    await this.save(items);
    return { succeeded, failed, dropped, remaining: items.length };
  }

  async clear(): Promise<void> {
    await this.save([]);
  }
}

/** Simple in-memory storage, handy for tests and SSR. */
/** Generate an id suitable for an Idempotency-Key. */
export function newMutationId(): string {
  return defaultId();
}

export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  async getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

/** Exponential backoff with full jitter, capped. */
export function backoffDelayMs(attempt: number, baseMs = 1000, capMs = 60_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.floor(Math.random() * exp);
}
