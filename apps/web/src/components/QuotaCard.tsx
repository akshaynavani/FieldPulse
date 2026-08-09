import type { QuotaProgress } from "@fieldpulse/contracts";
import { formatMoney, formatPercent } from "@fieldpulse/core";

export function QuotaCard({ quota }: { quota: QuotaProgress }) {
  return (
    <div className="card">
      <div className="muted">Quarter to date ({quota.quarterStart} – {quota.quarterEnd})</div>
      <div className="stat">
        {formatMoney(quota.closedWonCents, "USD", true)}{" "}
        <span className="muted">of {formatMoney(quota.targetCents, "USD", true)}</span>
      </div>
      <div className="progress">
        <div style={{ width: `${Math.min(100, quota.attainment * 100)}%` }} />
      </div>
      <div className="muted">
        {formatPercent(quota.attainment)} attained · {formatPercent(quota.projectedAttainment)} projected ·{" "}
        {quota.daysRemaining} days left
      </div>
    </div>
  );
}
