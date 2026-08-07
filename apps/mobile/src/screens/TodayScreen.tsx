import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Account } from "@fieldpulse/contracts";
import { accountsDueForVisit, overdueFollowUps, planRoute, relativeDay, visitsForDay } from "@fieldpulse/core";
import { useAccounts, usePipelineSummary, useVisits } from "@fieldpulse/hooks";
import { QuotaCard } from "../components/QuotaCard";
import { SyncBanner } from "../components/SyncBanner";
import { Card, ErrorText, Loading } from "../components/ui";
import { useCurrentPosition } from "../location";
import type { RootStackParamList } from "../navigation";
import { colors, shared } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TodayScreen() {
  const nav = useNavigation<Nav>();
  const position = useCurrentPosition();
  const visits = useVisits({ status: "all" });
  const accounts = useAccounts({ pageSize: 100 });
  const pipeline = usePipelineSummary();

  const byId = useMemo(
    () => new Map<string, Account>((accounts.data?.items ?? []).map((a) => [a.id, a])),
    [accounts.data],
  );

  // Order today's stops by driving distance from where the rep is right now.
  const route = useMemo(() => {
    const today = visitsForDay(visits.data?.visits ?? [], new Date());
    const stops = today
      .map((visit) => ({ visit, account: byId.get(visit.accountId) }))
      .filter((s): s is { visit: (typeof today)[number]; account: Account } => !!s.account)
      .map((s) => ({ ...s, location: s.account.location }));
    if (!position) return stops.map((item) => ({ item, legKm: 0, cumulativeKm: 0 }));
    return planRoute(position, stops);
  }, [visits.data, byId, position]);

  const followUps = useMemo(() => overdueFollowUps(visits.data?.visits ?? []), [visits.data]);
  const due = useMemo(() => accountsDueForVisit(accounts.data?.items ?? []).slice(0, 5), [accounts.data]);

  const refreshing = visits.isRefetching || accounts.isRefetching || pipeline.isRefetching;
  const refresh = () => {
    void visits.refetch();
    void accounts.refetch();
    void pipeline.refetch();
  };

  return (
    <View style={shared.screen}>
      <SyncBanner />
      <ScrollView contentContainerStyle={shared.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {pipeline.data && <QuotaCard quota={pipeline.data.quota} />}

        <Text style={shared.h2}>Today's route</Text>
        {visits.isLoading || accounts.isLoading ? (
          <Loading />
        ) : route.length === 0 ? (
          <Text style={shared.muted}>No visits scheduled for today.</Text>
        ) : (
          route.map(({ item, legKm, cumulativeKm }, i) => (
            <Pressable
              key={item.visit.id}
              onPress={() =>
                nav.navigate("LogVisit", {
                  visitId: item.visit.id,
                  accountId: item.account.id,
                  accountName: item.account.name,
                })
              }
            >
              <Card>
                <View style={shared.row}>
                  <Text style={[shared.h2, { color: colors.primary }]}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={shared.h2}>{item.account.name}</Text>
                    <Text style={shared.muted}>
                      {new Date(item.visit.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ·{" "}
                      {item.account.address}
                    </Text>
                  </View>
                  {position && (
                    <Text style={shared.muted}>
                      {legKm.toFixed(1)} km{"\n"}Σ {cumulativeKm.toFixed(1)}
                    </Text>
                  )}
                </View>
              </Card>
            </Pressable>
          ))
        )}

        {followUps.length > 0 && (
          <>
            <Text style={shared.h2}>Overdue follow-ups</Text>
            {followUps.map((v) => (
              <Card key={v.id}>
                <Text style={shared.body}>{byId.get(v.accountId)?.name ?? "Account"}</Text>
                <Text style={{ color: colors.danger, fontSize: 13 }}>Due {relativeDay(v.followUpAt!)}</Text>
                {!!v.notes && <Text style={shared.muted}>{v.notes}</Text>}
              </Card>
            ))}
          </>
        )}

        {due.length > 0 && (
          <>
            <Text style={shared.h2}>Accounts due a visit</Text>
            {due.map(({ account, daysSinceVisit }) => (
              <Pressable key={account.id} onPress={() => nav.navigate("AccountDetail", { accountId: account.id, name: account.name })}>
                <Card>
                  <Text style={shared.body}>
                    {account.name} <Text style={shared.muted}>· Tier {account.tier}</Text>
                  </Text>
                  <Text style={shared.muted}>
                    {daysSinceVisit === null ? "Never visited" : `Last visit ${daysSinceVisit} days ago`}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </>
        )}
        <ErrorText error={visits.error ?? accounts.error ?? pipeline.error} />
      </ScrollView>
    </View>
  );
}
