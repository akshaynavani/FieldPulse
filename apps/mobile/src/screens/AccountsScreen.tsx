import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AccountTier } from "@fieldpulse/contracts";
import { relativeDay } from "@fieldpulse/core";
import { useAccounts } from "@fieldpulse/hooks";
import { Card, Chip, ErrorText, Loading } from "../components/ui";
import type { RootStackParamList } from "../navigation";
import { shared, spacing } from "../theme";

const TIERS: AccountTier[] = ["A", "B", "C"];

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function AccountsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<AccountTier | undefined>();
  const debounced = useDebounced(search);
  const accounts = useAccounts({ search: debounced || undefined, tier, pageSize: 50 });

  return (
    <View style={shared.screen}>
      <View style={{ padding: spacing(4), gap: spacing(2) }}>
        <TextInput style={shared.input} placeholder="Search accounts or industry" value={search} onChangeText={setSearch} />
        <View style={shared.row}>
          {TIERS.map((t) => (
            <Chip key={t} label={`Tier ${t}`} selected={tier === t} onPress={() => setTier(tier === t ? undefined : t)} />
          ))}
        </View>
      </View>
      {accounts.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={accounts.data?.items ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingHorizontal: spacing(4), gap: spacing(2), paddingBottom: spacing(8) }}
          ListEmptyComponent={<Text style={shared.muted}>No accounts match.</Text>}
          ListFooterComponent={<ErrorText error={accounts.error} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => nav.navigate("AccountDetail", { accountId: item.id, name: item.name })}>
              <Card>
                <Text style={shared.h2}>{item.name}</Text>
                <Text style={shared.muted}>
                  {item.industry} · Tier {item.tier} ·{" "}
                  {item.lastVisitAt ? `visited ${relativeDay(item.lastVisitAt)}` : "never visited"}
                </Text>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
