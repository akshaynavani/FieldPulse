import { formatMoney, relativeDay } from "@fieldpulse/core";
import { useRevokeSession, useSessions } from "@fieldpulse/hooks";
import { useAuth } from "../auth";
import { ErrorText } from "../components/ErrorText";

export function SettingsPage() {
  const { state } = useAuth();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  if (state.status !== "signedIn") return null;
  const u = state.user;

  return (
    <div className="grid">
      <h2>Settings</h2>
      <div className="card">
        <strong>{u.name}</strong>
        <div className="muted">{u.email} · {u.role} · {u.territory}</div>
        <div className="muted">Quarterly quota {formatMoney(u.quarterlyQuotaCents, "USD")}</div>
      </div>
      <table>
        <thead><tr><th>Device</th><th>Signed in</th><th>Last active</th><th /></tr></thead>
        <tbody>
          {(sessions.data?.sessions ?? []).map((s) => (
            <tr key={s.id}>
              <td>{s.deviceLabel ?? "Unknown device"} {s.current && <span className="muted">(this browser)</span>}</td>
              <td>{relativeDay(s.createdAt)}</td>
              <td>{relativeDay(s.lastSeenAt)}</td>
              <td>{!s.current && <button className="secondary" onClick={() => revoke.mutate(s.id)}>Revoke</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ErrorText error={sessions.error ?? revoke.error} />
    </div>
  );
}
