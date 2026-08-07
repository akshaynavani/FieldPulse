import { ScrollView, Text, View } from "react-native";
import { formatMoney, relativeDay } from "@fieldpulse/core";
import { useRevokeSession, useSessions } from "@fieldpulse/hooks";
import { API_URL } from "../api";
import { useAuth, useCurrentUser } from "../auth";
import { Button, Card, ErrorText } from "../components/ui";
import { usePendingCount } from "../sync";
import { shared, spacing } from "../theme";

export function SettingsScreen() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const pending = usePendingCount();

  return (
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Card>
        <Text style={shared.h2}>{user.name}</Text>
        <Text style={shared.muted}>
          {user.email} · {user.role} · {user.territory}
        </Text>
        <Text style={shared.muted}>Quarterly quota {formatMoney(user.quarterlyQuotaCents, "USD")}</Text>
      </Card>

      <Card>
        <Text style={shared.body}>Pending offline changes: {pending}</Text>
        <Text style={shared.muted}>API: {API_URL}</Text>
      </Card>

      <Text style={shared.h2}>Signed-in devices</Text>
      {(sessions.data?.sessions ?? []).map((s) => (
        <Card key={s.id}>
          <View style={[shared.row, { justifyContent: "space-between" }]}>
            <View style={{ flex: 1 }}>
              <Text style={shared.body}>
                {s.deviceLabel ?? "Unknown device"}
                {s.current ? " (this device)" : ""}
              </Text>
              <Text style={shared.muted}>Active {relativeDay(s.lastSeenAt)}</Text>
            </View>
            {!s.current && (
              <View style={{ width: 100 }}>
                <Button title="Revoke" variant="secondary" onPress={() => revoke.mutate(s.id)} />
              </View>
            )}
          </View>
        </Card>
      ))}
      <ErrorText error={sessions.error ?? revoke.error} />

      <View style={{ marginTop: spacing(4) }}>
        <Button title="Sign out" variant="danger" onPress={() => void signOut()} />
      </View>
    </ScrollView>
  );
}
