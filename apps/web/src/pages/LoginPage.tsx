import { useState, type FormEvent } from "react";
import { LoginRequestSchema } from "@fieldpulse/contracts";
import { useAuth } from "../auth";
import { ErrorText } from "../components/ErrorText";

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = LoginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0]?.message ?? "Invalid input"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login card">
      <h1>FieldPulse</h1>
      <p className="muted">Sign in to manage your territory.</p>
      <form className="stack" onSubmit={submit}>
        <input type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <ErrorText error={error} />
        <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
