import { createContext, useContext, type ReactNode } from "react";
import type { FieldPulseClient } from "@fieldpulse/api-client";
import type { OfflineQueue } from "@fieldpulse/core";

interface ApiContextValue {
  client: FieldPulseClient;
  /** When provided, mutations that fail with a network error are queued for later. */
  offlineQueue?: OfflineQueue;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({
  client,
  offlineQueue,
  children,
}: ApiContextValue & { children: ReactNode }) {
  return <ApiContext.Provider value={{ client, offlineQueue }}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi must be used inside <ApiProvider>");
  return ctx;
}
