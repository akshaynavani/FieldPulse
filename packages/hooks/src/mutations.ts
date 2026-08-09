import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  Deal,
  DealListResponse,
  DealStage,
  RouteName,
  User,
} from "@fieldpulse/contracts";
import { NetworkError, type CallArgs, type FieldPulseClient } from "@fieldpulse/api-client";
import { newMutationId, summarizePipeline, type OfflineQueue, type QueuedMutation } from "@fieldpulse/core";
import { useApi } from "./context.js";
import { queryKeys } from "./keys.js";

export type MutationOutcome<T> = { queued: false; data: T } | { queued: true; mutationId: string };

/**
 * Try a mutation live with an idempotency key. If the network is unreachable and an
 * offline queue is configured, park it in the queue with the same key so a later
 * replay can never double-apply it.
 */
export async function runOrQueue<N extends RouteName>(
  client: FieldPulseClient,
  queue: OfflineQueue | undefined,
  name: N,
  args: CallArgs<N>,
) {
  const id = newMutationId();
  try {
    const data = await client.call(name, { ...args, idempotencyKey: id });
    return { queued: false as const, data };
  } catch (err) {
    if (err instanceof NetworkError && queue) {
      const { signal: _s, ...serialisable } = args;
      await queue.enqueue(name, serialisable, id);
      return { queued: true as const, mutationId: id };
    }
    throw err;
  }
}

/** Executor for OfflineQueue.flush that replays queued mutations through the client. */
export function createQueueExecutor(client: FieldPulseClient) {
  return async (m: QueuedMutation) => {
    const args = m.payload as CallArgs<RouteName>;
    await client.call(m.kind as RouteName, { ...args, idempotencyKey: m.id } as never);
  };
}

/** Patch every cached deal list and recompute the pipeline locally via @fieldpulse/core. */
function applyDealLocally(qc: QueryClient, updated: Deal) {
  qc.setQueriesData<DealListResponse>({ queryKey: ["deals"] }, (old) =>
    old ? { deals: old.deals.map((d) => (d.id === updated.id ? updated : d)) } : old,
  );
  const all = qc.getQueryData<DealListResponse>(queryKeys.deals({}));
  const me = qc.getQueryData<User>(queryKeys.me);
  if (all && me) {
    qc.setQueryData(queryKeys.pipeline, summarizePipeline(all.deals, me.quarterlyQuotaCents));
  }
}

export function useMoveDealStage() {
  const { client, offlineQueue } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { deal: Deal; stage: DealStage; lostReason?: string }) =>
      runOrQueue(client, offlineQueue, "updateDealStage", {
        params: { id: v.deal.id },
        body: { stage: v.stage, lostReason: v.lostReason, expectedUpdatedAt: v.deal.updatedAt },
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["deals"] });
      const snapshot = qc.getQueriesData<DealListResponse>({ queryKey: ["deals"] });
      const pipeline = qc.getQueryData(queryKeys.pipeline);
      const isClosed = v.stage === "closed_won" || v.stage === "closed_lost";
      applyDealLocally(qc, {
        ...v.deal,
        stage: v.stage,
        lostReason: v.stage === "closed_lost" ? (v.lostReason ?? null) : null,
        closedAt: isClosed ? new Date().toISOString() : null,
      });
      return { snapshot, pipeline };
    },
    onError: (_err, _v, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx?.pipeline) qc.setQueryData(queryKeys.pipeline, ctx.pipeline);
    },
    onSuccess: (result) => {
      if (!result.queued) applyDealLocally(qc, result.data);
    },
    onSettled: (result) => {
      // When queued, keep the optimistic state until the queue flushes.
      if (!result?.queued) {
        void qc.invalidateQueries({ queryKey: ["deals"] });
        void qc.invalidateQueries({ queryKey: queryKeys.pipeline });
      }
    },
  });
}

export function useCreateDeal() {
  const { client } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CallArgs<"createDeal">["body"]) => client.call("createDeal", { body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: queryKeys.pipeline });
    },
  });
}

export function useCompleteVisit() {
  const { client, offlineQueue } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { visitId: string; body: CallArgs<"completeVisit">["body"] }) =>
      runOrQueue(client, offlineQueue, "completeVisit", { params: { id: v.visitId }, body: v.body }),
    onSuccess: (result) => {
      if (result.queued) return;
      void qc.invalidateQueries({ queryKey: ["visits"] });
      void qc.invalidateQueries({ queryKey: ["account", result.data.accountId] });
      void qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useScheduleVisit() {
  const { client, offlineQueue } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CallArgs<"scheduleVisit">["body"]) =>
      runOrQueue(client, offlineQueue, "scheduleVisit", { body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["visits"] }),
  });
}

export function useRevokeSession() {
  const { client } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.call("revokeSession", { params: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}

/** Flush the offline queue and refresh everything it may have touched. */
export function useFlushQueue() {
  const { client, offlineQueue } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!offlineQueue) return null;
      return offlineQueue.flush(createQueueExecutor(client));
    },
    onSuccess: (result) => {
      if (result && result.succeeded + result.dropped.length > 0) void qc.invalidateQueries();
    },
  });
}

export function useCreateAccount() {
  const { client } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CallArgs<"createAccount">["body"]) => client.call("createAccount", { body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useAddContact(accountId: string) {
  const { client } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CallArgs<"addContact">["body"]) =>
      client.call("addContact", { params: { id: accountId }, body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.account(accountId) }),
  });
}
