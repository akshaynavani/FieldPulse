import { useEffect, useState } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useFlushQueue } from "@fieldpulse/hooks";
import { offlineQueue } from "./api";

/** Pending offline mutation count, kept live via the queue's subscription. */
export function usePendingCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    void offlineQueue.size().then(setCount);
    return offlineQueue.subscribe(setCount);
  }, []);
  return count;
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(
    () => NetInfo.addEventListener((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false)),
    [],
  );
  return online;
}

/**
 * Flush the offline queue whenever connectivity returns or the app comes to the
 * foreground. The queue itself guarantees ordering and de-duplicates concurrent flushes.
 */
export function useAutoSync() {
  const flush = useFlushQueue();
  const online = useIsOnline();

  useEffect(() => {
    if (online) flush.mutate();
  }, [online]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") flush.mutate();
    });
    return () => sub.remove();
  }, []);

  return { online, flush };
}
