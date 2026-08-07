import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { DEAL_STAGES, type Deal, type DealStage } from "@fieldpulse/contracts";
import { STAGE_LABELS, allowedNextStages, formatMoney, formatPercent, groupByStage } from "@fieldpulse/core";
import { useDeals, useMoveDealStage, usePipelineSummary } from "@fieldpulse/hooks";
import { QuotaCard } from "../components/QuotaCard";
import { SyncBanner } from "../components/SyncBanner";
import { Button, Card, Chip, ErrorText, Loading } from "../components/ui";
import { colors, shared, spacing } from "../theme";

function DealRow({ deal }: { deal: Deal }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<DealStage | null>(null);
  const [reason, setReason] = useState("");
  const move = useMoveDealStage();

  function confirm(stage: DealStage) {
    if (stage === "closed_lost" && reason.trim().length < 3) {
      setTarget(stage);
      return;
    }
    move.mutate(
      { deal, stage, lostReason: stage === "closed_lost" ? reason.trim() : undefined },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <Card>
      <Pressable onPress={() => setOpen(!open)}>
        <Text style={shared.body}>{deal.title}</Text>
        <Text style={shared.muted}>
          {formatMoney(deal.amountCents, deal.currency)} · closes {deal.expectedCloseDate}
        </Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: spacing(3), gap: spacing(2) }}>
          <Text style={shared.muted}>Move to</Text>
          <View style={[shared.row, { flexWrap: "wrap" }]}>
            {allowedNextStages(deal.stage).map((s) => (
              <Chip key={s} label={STAGE_LABELS[s]} selected={target === s} onPress={() => confirm(s)} />
            ))}
          </View>
          {target === "closed_lost" && (
            <>
              <TextInput style={shared.input} placeholder="Why was it lost?" value={reason} onChangeText={setReason} />
              <Button title="Close as lost" variant="danger" onPress={() => confirm("closed_lost")} loading={move.isPending} />
            </>
          )}
          <ErrorText error={move.error} />
        </View>
      )}
    </Card>
  );
}

export function PipelineScreen() {
  const deals = useDeals();
  const summary = usePipelineSummary();
  const board = useMemo(() => groupByStage(deals.data?.deals ?? []), [deals.data]);
  const [stage, setStage] = useState<DealStage>("prospecting");

  const stageSummary = summary.data?.stages.find((s) => s.stage === stage);

  return (
    <View style={shared.screen}>
      <SyncBanner />
      <ScrollView
        contentContainerStyle={shared.content}
        refreshControl={
          <RefreshControl
            refreshing={deals.isRefetching}
            onRefresh={() => {
              void deals.refetch();
              void summary.refetch();
            }}
          />
        }
      >
        {summary.data && (
          <>
            <QuotaCard quota={summary.data.quota} />
            <Card>
              <Text style={shared.muted}>Open pipeline</Text>
              <Text style={shared.h1}>{formatMoney(summary.data.totalOpenCents, "USD", true)}</Text>
              <Text style={shared.muted}>
                Weighted {formatMoney(summary.data.totalWeightedCents, "USD", true)} · Win rate{" "}
                {summary.data.winRate === null ? "—" : formatPercent(summary.data.winRate)}
              </Text>
            </Card>
          </>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing(2) }}>
          {DEAL_STAGES.map((s) => (
            <Chip key={s} label={`${STAGE_LABELS[s]} (${board[s].length})`} selected={s === stage} onPress={() => setStage(s)} />
          ))}
        </ScrollView>

        {stageSummary && (
          <Text style={shared.muted}>
            {formatMoney(stageSummary.amountCents, "USD")} total ·{" "}
            <Text style={{ color: colors.primary }}>{formatMoney(stageSummary.weightedAmountCents, "USD")} weighted</Text>
          </Text>
        )}

        {deals.isLoading ? (
          <Loading />
        ) : board[stage].length === 0 ? (
          <Text style={shared.muted}>No deals in this stage.</Text>
        ) : (
          board[stage].map((d) => <DealRow key={d.id} deal={d} />)
        )}
        <ErrorText error={deals.error ?? summary.error} />
      </ScrollView>
    </View>
  );
}
