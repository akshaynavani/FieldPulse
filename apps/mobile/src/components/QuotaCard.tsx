import { Text, View } from "react-native";
import type { QuotaProgress } from "@fieldpulse/contracts";
import { formatMoney, formatPercent } from "@fieldpulse/core";
import { colors, shared } from "../theme";
import { Card, ProgressBar } from "./ui";

export function QuotaCard({ quota }: { quota: QuotaProgress }) {
  const onTrack = quota.projectedAttainment >= 1;
  return (
    <Card>
      <Text style={shared.h2}>Quarter to date</Text>
      <Text style={[shared.h1, { marginTop: 4 }]}>
        {formatMoney(quota.closedWonCents, "USD", true)}
        <Text style={shared.muted}> of {formatMoney(quota.targetCents, "USD", true)}</Text>
      </Text>
      <View style={{ marginVertical: 8 }}>
        <ProgressBar value={quota.attainment} color={onTrack ? colors.success : colors.primary} />
      </View>
      <Text style={shared.muted}>
        {formatPercent(quota.attainment)} attained · {formatPercent(quota.projectedAttainment)} projected ·{" "}
        {quota.daysRemaining} days left
      </Text>
    </Card>
  );
}
