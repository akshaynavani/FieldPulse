import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@fieldpulse/contracts";
import { queryKeys } from "@fieldpulse/hooks";
import { client, onUnauthorized, tokenStore } from "./api";

type AuthState = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; user: User };

interface AuthValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const qc = useQueryClient();

  const clearLocal = useCallback(() => {
    tokenStore.clear();
    qc.clear();
    setState({ status: "signedOut" });
  }, [qc]);

  useEffect(() => {
    onUnauthorized(clearLocal);
    if (!tokenStore.get()) {
      setState({ status: "signedOut" });
      return;
    }
    client
      .me()
      .then((user) => {
        qc.setQueryData(queryKeys.me, user);
        setState({ status: "signedIn", user });
      })
      .catch(() => setState({ status: "signedOut" }));
  }, [clearLocal, qc]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await client.login({ email, password, deviceLabel: "FieldPulse web" });
      tokenStore.set(res.token);
      qc.setQueryData(queryKeys.me, res.user);
      setState({ status: "signedIn", user: res.user });
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    await client.logout().catch(() => undefined);
    clearLocal();
  }, [clearLocal]);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
