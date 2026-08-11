import { useMemo } from "react";
import { Link } from "react-router-dom";
import { overdueFollowUps, relativeDay } from "@fieldpulse/core";
import { useAccounts, useVisits } from "@fieldpulse/hooks";
import { ErrorText } from "../components/ErrorText";

export function VisitsPage() {
  const from = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const upcoming = useVisits({ status: "scheduled", from });
  const completed = useVisits({ status: "completed" });
  const accounts = useAccounts({ pageSize: 100 });
  const names = new Map((accounts.data?.items ?? []).map((a) => [a.id, a.name]));
  const followUps = overdueFollowUps(completed.data?.visits ?? []);

  return (
    <div className="grid">
      <h2>Visits</h2>
      <section className="card grid">
        <strong>Upcoming</strong>
        <table>
          <thead><tr><th>When</th><th>Account</th><th>Notes</th></tr></thead>
          <tbody>
            {(upcoming.data?.visits ?? []).map((v) => (
              <tr key={v.id}>
                <td>{new Date(v.scheduledAt).toLocaleString()} <span className="muted">({relativeDay(v.scheduledAt)})</span></td>
                <td><Link to={`/accounts/${v.accountId}`}>{names.get(v.accountId) ?? "Account"}</Link></td>
                <td>{v.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card grid">
        <strong>Overdue follow-ups</strong>
        {followUps.length === 0 && <span className="muted">Nothing overdue.</span>}
        {followUps.map((v) => (
          <div key={v.id}>
            <Link to={`/accounts/${v.accountId}`}>{names.get(v.accountId) ?? "Account"}</Link>{" "}
            <span className="error">due {relativeDay(v.followUpAt!)}</span>
            {v.notes && <div className="muted">{v.notes}</div>}
          </div>
        ))}
      </section>
      <ErrorText error={upcoming.error ?? completed.error} />
    </div>
  );
}
