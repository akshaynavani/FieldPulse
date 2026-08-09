import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { AccountTier } from "@fieldpulse/contracts";
import { CreateAccountSchema } from "@fieldpulse/contracts";
import { relativeDay } from "@fieldpulse/core";
import { useAccounts, useCreateAccount } from "@fieldpulse/hooks";
import { ErrorText } from "../components/ErrorText";

const PAGE_SIZE = 20;

function NewAccountForm({ onDone }: { onDone: () => void }) {
  const create = useCreateAccount();
  const [form, setForm] = useState({ name: "", industry: "", tier: "B", address: "", lat: "", lng: "" });
  const [error, setError] = useState<unknown>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = CreateAccountSchema.safeParse({
      name: form.name,
      industry: form.industry,
      tier: form.tier,
      address: form.address,
      location: { lat: Number(form.lat), lng: Number(form.lng) },
    });
    if (!parsed.success) {
      setError(new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")));
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      onDone();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <strong>New account</strong>
      <div className="row">
        <input placeholder="Name" value={form.name} onChange={set("name")} />
        <input placeholder="Industry" value={form.industry} onChange={set("industry")} />
        <select value={form.tier} onChange={set("tier")}>
          <option value="A">Tier A</option>
          <option value="B">Tier B</option>
          <option value="C">Tier C</option>
        </select>
      </div>
      <input placeholder="Address" value={form.address} onChange={set("address")} />
      <div className="row">
        <input placeholder="Latitude" value={form.lat} onChange={set("lat")} />
        <input placeholder="Longitude" value={form.lng} onChange={set("lng")} />
      </div>
      <ErrorText error={error} />
      <div className="row">
        <button type="submit" disabled={create.isPending}>Create</button>
        <button type="button" className="secondary" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function AccountsPage() {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<AccountTier | "">("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const accounts = useAccounts({ search: search || undefined, tier: tier || undefined, page, pageSize: PAGE_SIZE });
  const total = accounts.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="grid">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Accounts</h2>
        {!creating && <button onClick={() => setCreating(true)}>New account</button>}
      </div>
      {creating && <NewAccountForm onDone={() => setCreating(false)} />}
      <div className="row">
        <input placeholder="Search name or industry" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={tier} onChange={(e) => { setTier(e.target.value as AccountTier | ""); setPage(1); }}>
          <option value="">All tiers</option>
          <option value="A">Tier A</option>
          <option value="B">Tier B</option>
          <option value="C">Tier C</option>
        </select>
        <span className="muted">{total} accounts</span>
      </div>
      <table>
        <thead>
          <tr><th>Name</th><th>Industry</th><th>Tier</th><th>Address</th><th>Last visit</th></tr>
        </thead>
        <tbody>
          {(accounts.data?.items ?? []).map((a) => (
            <tr key={a.id}>
              <td><Link to={`/accounts/${a.id}`}>{a.name}</Link></td>
              <td>{a.industry}</td>
              <td>{a.tier}</td>
              <td>{a.address}</td>
              <td>{a.lastVisitAt ? relativeDay(a.lastVisitAt) : "never"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span className="muted">Page {page} of {pages}</span>
        <button className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
      <ErrorText error={accounts.error} />
    </div>
  );
}
