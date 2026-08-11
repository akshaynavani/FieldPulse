import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { OUTCOME_LABELS, STAGE_LABELS, formatMoney, relativeDay } from "@fieldpulse/core";
import { useAccount, useAddContact, useCreateDeal, useDeals, useScheduleVisit, useVisits } from "@fieldpulse/hooks";
import { ErrorText } from "../components/ErrorText";

function NewDealForm({ accountId }: { accountId: string }) {
  const create = useCreateDeal();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [close, setClose] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { accountId, title, amountCents: Math.round(Number(amount) * 100), expectedCloseDate: close },
      { onSuccess: () => { setTitle(""); setAmount(""); setClose(""); } },
    );
  }

  return (
    <form className="row" onSubmit={submit}>
      <input placeholder="Deal title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input placeholder="Amount (USD)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <input type="date" value={close} onChange={(e) => setClose(e.target.value)} />
      <button type="submit" disabled={create.isPending}>Add deal</button>
      <ErrorText error={create.error} />
    </form>
  );
}

function NewContactForm({ accountId }: { accountId: string }) {
  const add = useAddContact(accountId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    add.mutate(
      { name, email: email || null, phone: phone || null },
      { onSuccess: () => { setName(""); setEmail(""); setPhone(""); } },
    );
  }

  return (
    <form className="row" onSubmit={submit}>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <button type="submit" disabled={add.isPending}>Add contact</button>
      <ErrorText error={add.error} />
    </form>
  );
}

export function AccountDetailPage() {
  const { id = "" } = useParams();
  const account = useAccount(id);
  const deals = useDeals({ accountId: id });
  const visits = useVisits({ accountId: id });
  const schedule = useScheduleVisit();
  const [when, setWhen] = useState("");

  if (account.isLoading) return <p>Loading…</p>;
  if (!account.data) return <ErrorText error={account.error ?? new Error("Account not found")} />;
  const a = account.data;

  return (
    <div className="grid">
      <div className="card">
        <h2 style={{ margin: 0 }}>{a.name}</h2>
        <div className="muted">{a.industry} · Tier {a.tier} · {a.address}</div>
        <div className="muted">{a.lastVisitAt ? `Last visited ${relativeDay(a.lastVisitAt)}` : "Never visited"}</div>
      </div>

      <section className="card grid">
        <strong>Contacts</strong>
        {a.contacts.map((c) => (
          <div key={c.id}>
            {c.name} {c.title && <span className="muted">· {c.title}</span>}{" "}
            {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>} {c.phone && <span className="muted">{c.phone}</span>}
          </div>
        ))}
        <NewContactForm accountId={id} />
      </section>

      <section className="card grid">
        <strong>Deals</strong>
        <table>
          <thead><tr><th>Title</th><th>Stage</th><th>Amount</th><th>Close</th></tr></thead>
          <tbody>
            {(deals.data?.deals ?? []).map((d) => (
              <tr key={d.id}>
                <td>{d.title}</td>
                <td>{STAGE_LABELS[d.stage]}</td>
                <td>{formatMoney(d.amountCents, d.currency)}</td>
                <td>{d.expectedCloseDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <NewDealForm accountId={id} />
      </section>

      <section className="card grid">
        <strong>Visits</strong>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (when) schedule.mutate({ accountId: id, scheduledAt: new Date(when).toISOString() });
          }}
        >
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <button type="submit" disabled={!when || schedule.isPending}>Schedule visit</button>
          <ErrorText error={schedule.error} />
        </form>
        {(visits.data?.visits ?? []).slice().reverse().map((v) => (
          <div key={v.id}>
            {new Date(v.scheduledAt).toLocaleString()} —{" "}
            {v.completedAt ? (v.outcome ? OUTCOME_LABELS[v.outcome] : "Completed") : <span className="muted">scheduled</span>}
            {v.notes && <div className="muted">{v.notes}</div>}
          </div>
        ))}
      </section>
    </div>
  );
}
