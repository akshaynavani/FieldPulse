import { useMemo, useState } from "react";
import { DEAL_STAGES, type Deal, type DealStage } from "@fieldpulse/contracts";
import { STAGE_LABELS, allowedNextStages, formatMoney, formatPercent, groupByStage } from "@fieldpulse/core";
import { useDeals, useMoveDealStage, usePipelineSummary } from "@fieldpulse/hooks";
import { ErrorText } from "../components/ErrorText";
import { QuotaCard } from "../components/QuotaCard";

function DealCard({ deal }: { deal: Deal }) {
  const move = useMoveDealStage();
  const [target, setTarget] = useState<DealStage | "">("");

  function onChange(stage: DealStage | "") {
    if (!stage) return;
    let lostReason: string | undefined;
    if (stage === "closed_lost") {
      lostReason = window.prompt("Why was this deal lost?")?.trim();
      if (!lostReason) return;
    }
    setTarget(stage);
    move.mutate({ deal, stage, lostReason }, { onSettled: () => setTarget("") });
  }

  return (
    <div className="deal">
      <strong>{deal.title}</strong>
      <div className="muted">
        {formatMoney(deal.amountCents, deal.currency)} · {deal.expectedCloseDate}
      </div>
      <select value={target} onChange={(e) => onChange(e.target.value as DealStage | "")} disabled={move.isPending}>
        <option value="">Move to…</option>
        {allowedNextStages(deal.stage).map((s) => (
          <option key={s} value={s}>{STAGE_LABELS[s]}</option>
        ))}
      </select>
      <ErrorText error={move.error} />
    </div>
  );
}

export function DashboardPage() {
  const summary = usePipelineSummary();
  const deals = useDeals();
  const board = useMemo(() => groupByStage(deals.data?.deals ?? []), [deals.data]);
  const s = summary.data;

  return (
    <div className="grid">
      <h2>Dashboard</h2>
      {s && (
        <div className="grid grid-3">
          <QuotaCard quota={s.quota} />
          <div className="card">
            <div className="muted">Open pipeline</div>
            <div className="stat">{formatMoney(s.totalOpenCents, "USD", true)}</div>
            <div className="muted">Weighted {formatMoney(s.totalWeightedCents, "USD", true)}</div>
          </div>
          <div className="card">
            <div className="muted">Win rate</div>
            <div className="stat">{s.winRate === null ? "—" : formatPercent(s.winRate)}</div>
            <div className="muted">Closed deals, all time</div>
          </div>
        </div>
      )}
      <div className="board">
        {DEAL_STAGES.map((stage) => {
          const stats = s?.stages.find((x) => x.stage === stage);
          return (
            <div className="column" key={stage}>
              <h3>
                <span>{STAGE_LABELS[stage]}</span>
                <span className="muted">{stats ? formatMoney(stats.amountCents, "USD", true) : ""}</span>
              </h3>
              {board[stage].map((d) => (
                <DealCard key={d.id} deal={d} />
              ))}
            </div>
          );
        })}
      </div>
      <ErrorText error={summary.error ?? deals.error} />
    </div>
  );
}
