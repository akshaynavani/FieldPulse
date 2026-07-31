import { useQuery } from "@tanstack/react-query";
import type { RouteQuery } from "@fieldpulse/contracts";
import { useApi } from "./context.js";
import { queryKeys } from "./keys.js";

export function useMe(enabled = true) {
  const { client } = useApi();
  return useQuery({ queryKey: queryKeys.me, queryFn: () => client.me(), enabled });
}

export function useAccounts(q: RouteQuery<"listAccounts"> = {}) {
  const { client } = useApi();
  return useQuery({
    queryKey: queryKeys.accounts(q),
    queryFn: () => client.listAccounts(q),
    placeholderData: (prev) => prev,
  });
}

export function useAccount(id: string | undefined) {
  const { client } = useApi();
  return useQuery({
    queryKey: queryKeys.account(id ?? ""),
    queryFn: () => client.getAccount(id!),
    enabled: !!id,
  });
}

export function useVisits(q: RouteQuery<"listVisits"> = {}) {
  const { client } = useApi();
  return useQuery({ queryKey: queryKeys.visits(q), queryFn: () => client.listVisits(q) });
}

export function useDeals(q: RouteQuery<"listDeals"> = {}) {
  const { client } = useApi();
  return useQuery({ queryKey: queryKeys.deals(q), queryFn: () => client.listDeals(q) });
}

export function usePipelineSummary() {
  const { client } = useApi();
  return useQuery({ queryKey: queryKeys.pipeline, queryFn: () => client.pipelineSummary() });
}

export function useSessions() {
  const { client } = useApi();
  return useQuery({ queryKey: queryKeys.sessions, queryFn: () => client.call("listSessions", {}) });
}
