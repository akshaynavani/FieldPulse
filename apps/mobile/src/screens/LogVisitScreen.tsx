import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { ApiError } from "@fieldpulse/api-client";
import { CompleteVisitSchema, type LatLng, type VisitOutcome } from "@fieldpulse/contracts";
import { OUTCOME_LABELS, isOnSite } from "@fieldpulse/core";
import { useAccount, useCompleteVisit } from "@fieldpulse/hooks";
import { Button, Chip } from "../components/ui";
import { currentPosition } from "../location";
import type { RootScreenProps } from "../navigation";
import { colors, shared, spacing } from "../theme";

const OUTCOMES = Object.keys(OUTCOME_LABELS) as VisitOutcome[];
const FOLLOW_UP_DAYS = [1, 3, 7, 14];

export function LogVisitScreen({ route, navigation }: RootScreenProps<"LogVisit">) {
  const { visitId, accountId, accountName } = route.params;
  const account = useAccount(accountId);
  const complete = useCompleteVisit();
  const [outcome, setOutcome] = useState<VisitOutcome>("productive");
  const [notes, setNotes] = useState("");
  const [followUpDays, setFollowUpDays] = useState<number | null>(null);
  const [checkIn, setCheckIn] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSite = checkIn && account.data ? isOnSite(checkIn, account.data.location) : null;

  async function captureLocation() {
    const pos = await currentPosition();
    if (!pos) Alert.alert("Location unavailable", "Enable location access to verify your check-in.");
    setCheckIn(pos);
  }

  async function submit() {
    const now = new Date();
    const body = {
      completedAt: now.toISOString(),
      outcome,
      notes,
      followUpAt: followUpDays ? new Date(now.getTime() + followUpDays * 86_400_000).toISOString() : null,
      checkInLocation: checkIn,
    };
    // Validate with the shared contract before sending or queueing.
    const parsed = CompleteVisitSchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid visit");
      return;
    }
    try {
      const result = await complete.mutateAsync({ visitId, body });
      if (result.queued) {
        Alert.alert("Saved offline", "This visit will sync automatically when you're back online.");
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save visit");
    }
  }

  return (
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>{accountName}</Text>

      <Text style={shared.h2}>Outcome</Text>
      <View style={[shared.row, { flexWrap: "wrap" }]}>
        {OUTCOMES.map((o) => (
          <Chip key={o} label={OUTCOME_LABELS[o]} selected={outcome === o} onPress={() => setOutcome(o)} />
        ))}
      </View>

      <Text style={shared.h2}>Notes</Text>
      <TextInput
        style={[shared.input, { minHeight: 100, textAlignVertical: "top" }]}
        multiline
        placeholder="Who you met, what they need, next steps…"
        value={notes}
        onChangeText={setNotes}
      />

      <Text style={shared.h2}>Follow up</Text>
      <View style={[shared.row, { flexWrap: "wrap" }]}>
        <Chip label="None" selected={followUpDays === null} onPress={() => setFollowUpDays(null)} />
        {FOLLOW_UP_DAYS.map((d) => (
          <Chip key={d} label={`${d}d`} selected={followUpDays === d} onPress={() => setFollowUpDays(d)} />
        ))}
      </View>

      <View style={{ gap: spacing(2) }}>
        <Button title={checkIn ? "Update check-in location" : "Capture check-in location"} variant="secondary" onPress={captureLocation} />
        {onSite !== null && (
          <Text style={{ color: onSite ? colors.success : colors.warning }}>
            {onSite ? "On site ✓" : "You appear to be away from this account's address"}
          </Text>
        )}
      </View>

      {error && <Text style={{ color: colors.danger }}>{error}</Text>}
      <Button title="Complete visit" onPress={submit} loading={complete.isPending} />
    </ScrollView>
  );
}
