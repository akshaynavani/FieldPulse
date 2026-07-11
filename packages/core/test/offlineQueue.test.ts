import { describe, expect, it, vi } from "vitest";
import { MemoryStorage, OfflineQueue } from "../src/index.js";

function makeQueue(opts: ConstructorParameters<typeof OfflineQueue>[1] = {}) {
  let i = 0;
  return new OfflineQueue(new MemoryStorage(), { generateId: () => `m${++i}`, ...opts });
}

describe("OfflineQueue", () => {
  it("persists and replays in FIFO order", async () => {
    const q = makeQueue();
    await q.enqueue("createDeal", { title: "a" });
    await q.enqueue("updateDealStage", { stage: "qualified" });
    const seen: string[] = [];
    const result = await q.flush(async (m) => {
      seen.push(m.kind);
    });
    expect(seen).toEqual(["createDeal", "updateDealStage"]);
    expect(result).toMatchObject({ succeeded: 2, remaining: 0 });
  });

  it("stops at the first retryable failure to preserve ordering", async () => {
    const q = makeQueue();
    await q.enqueue("a", 1);
    await q.enqueue("b", 2);
    const exec = vi.fn().mockRejectedValueOnce(new Error("offline"));
    const result = await q.flush(exec);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ succeeded: 0, failed: 1, remaining: 2 });
    const [head] = await q.list();
    expect(head).toMatchObject({ attempts: 1, lastError: "offline" });
  });

  it("drops non-retryable mutations and continues", async () => {
    const q = makeQueue({ isRetryable: (e) => !(e instanceof TypeError) });
    await q.enqueue("bad", 1);
    await q.enqueue("good", 2);
    const exec = vi.fn().mockRejectedValueOnce(new TypeError("invalid")).mockResolvedValueOnce(undefined);
    const result = await q.flush(exec);
    expect(result.dropped.map((m) => m.kind)).toEqual(["bad"]);
    expect(result.succeeded).toBe(1);
  });

  it("drops after max attempts", async () => {
    const q = makeQueue({ maxAttempts: 2 });
    await q.enqueue("flaky", 1);
    const exec = vi.fn().mockRejectedValue(new Error("500"));
    await q.flush(exec);
    const second = await q.flush(exec);
    expect(second.dropped).toHaveLength(1);
    expect(await q.size()).toBe(0);
  });

  it("shares a single in-flight flush and notifies subscribers", async () => {
    const q = makeQueue();
    const sizes: number[] = [];
    q.subscribe((s) => sizes.push(s));
    await q.enqueue("x", 1);
    const exec = vi.fn().mockResolvedValue(undefined);
    await Promise.all([q.flush(exec), q.flush(exec)]);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(sizes).toEqual([1, 0]);
  });
});
