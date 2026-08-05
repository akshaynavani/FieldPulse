import { Pressable, Text } from "react-native";
import { useAutoSync, usePendingCount } from "../sync";
import { colors } from "../theme";

/** Thin banner showing offline state and queued changes; tap to retry sync. */
export function SyncBanner() {
  const { online, flush } = useAutoSync();
  const pending = usePendingCount();
  if (online && pending === 0) return null;

  const text = !online
    ? `Offline — ${pending} change${pending === 1 ? "" : "s"} will sync when you reconnect`
    : flush.isPending
      ? "Syncing…"
      : `${pending} change${pending === 1 ? "" : "s"} waiting to sync · tap to retry`;

  return (
    <Pressable
      onPress={() => flush.mutate()}
      style={{ backgroundColor: online ? colors.warning : colors.muted, padding: 8 }}
    >
      <Text style={{ color: "#fff", textAlign: "center", fontSize: 13 }}>{text}</Text>
    </Pressable>
  );
}
