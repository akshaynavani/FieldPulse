import { Linking, ScrollView, Text, View } from "react-native";
import { OUTCOME_LABELS, STAGE_LABELS, formatMoney, relativeDay } from "@fieldpulse/core";
import { useAccount, useDeals, useScheduleVisit, useVisits } from "@fieldpulse/hooks";
import { Button, Card, ErrorText, Loading } from "../components/ui";
import type { RootScreenProps } from "../navigation";
import { colors, shared } from "../theme";

export function AccountDetailScreen({ route, navigation }: RootScreenProps<"AccountDetail">) {
  const { accountId } = route.params;
  const account = useAccount(accountId);
  const deals = useDeals({ accountId });
  const visits = useVisits({ accountId });
  const schedule = useScheduleVisit();

  if (account.isLoading) return <Loading />;
  if (!account.data) return <ErrorText error={account.error} />;
  const a = account.data;

  async function startVisit() {
    const result = await schedule.mutateAsync({ accountId, scheduledAt: new Date().toISOString() });
    if (!result.queued) {
      navigation.navigate("LogVisit", { visitId: result.data.id, accountId, accountName: a.name });
    }
  }

  const openMaps = () =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${a.location.lat},${a.location.lng}`);

  return (
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Card>
        <Text style={shared.h1}>{a.name}</Text>
        <Text style={shared.muted}>
          {a.industry} · Tier {a.tier}
        </Text>
        <Text style={[shared.body, { marginTop: 8 }]}>{a.address}</Text>
        <Text style={shared.muted}>{a.lastVisitAt ? `Last visit ${relativeDay(a.lastVisitAt)}` : "Never visited"}</Text>
      </Card>
      <View style={{ gap: 8 }}>
        <Button title="Check in now" onPress={startVisit} loading={schedule.isPending} />
        <Button title="Directions" variant="secondary" onPress={openMaps} />
      </View>
      <ErrorText error={schedule.error} />

      <Text style={shared.h2}>Contacts</Text>
      {a.contacts.length === 0 && <Text style={shared.muted}>No contacts yet.</Text>}
      {a.contacts.map((c) => (
        <Card key={c.id}>
          <Text style={shared.body}>{c.name}</Text>
          {c.title && <Text style={shared.muted}>{c.title}</Text>}
          {c.phone && (
            <Text style={{ color: colors.primary }} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
              {c.phone}
            </Text>
          )}
          {c.email && (
            <Text style={{ color: colors.primary }} onPress={() => Linking.openURL(`mailto:${c.email}`)}>
              {c.email}
            </Text>
          )}
        </Card>
      ))}

      <Text style={shared.h2}>Deals</Text>
      {(deals.data?.deals ?? []).map((d) => (
        <Card key={d.id}>
          <Text style={shared.body}>{d.title}</Text>
          <Text style={shared.muted}>
            {STAGE_LABELS[d.stage]} · {formatMoney(d.amountCents, d.currency)} · closes {d.expectedCloseDate}
          </Text>
        </Card>
      ))}

      <Text style={shared.h2}>Visit history</Text>
      {(visits.data?.visits ?? [])
        .filter((v) => v.completedAt)
        .reverse()
        .map((v) => (
          <Card key={v.id}>
            <Text style={shared.body}>
              {relativeDay(v.completedAt!)} · {v.outcome ? OUTCOME_LABELS[v.outcome] : ""}
            </Text>
            {!!v.notes && <Text style={shared.muted}>{v.notes}</Text>}
          </Card>
        ))}
    </ScrollView>
  );
}
