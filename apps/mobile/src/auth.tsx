import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserSchema, type User } from "@fieldpulse/contracts";
import { NetworkError } from "@fieldpulse/api-client";
import { queryKeys } from "@fieldpulse/hooks";
import { client, offlineQueue, onUnauthorized, setToken } from "./api";
import { tokenStore } from "./storage";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: User };

interface AuthContextValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const USER_KEY = "fieldpulse.user";

async function cachedUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  const parsed = UserSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const qc = useQueryClient();

  const clearLocal = useCallback(async () => {
    setToken(null);
    await tokenStore.clear();
    await AsyncStorage.removeItem(USER_KEY);
    await offlineQueue.clear();
    qc.clear();
    setState({ status: "signedOut" });
  }, [qc]);

  // Restore a persisted session on launch.
  useEffect(() => {
    onUnauthorized(() => void clearLocal());
    (async () => {
      const token = await tokenStore.get();
      if (!token) return setState({ status: "signedOut" });
      setToken(token);
      try {
        const user = await client.me();
        qc.setQueryData(queryKeys.me, user);
        setState({ status: "signedIn", user });
      } catch (err) {
        // Offline at launch: trust the cached profile so reps can keep working;
        // a 401 once back online will sign them out via onUnauthorized.
        const user = err instanceof NetworkError ? await cachedUser() : null;
        if (user) {
          qc.setQueryData(queryKeys.me, user);
          setState({ status: "signedIn", user });
        } else {
          setState({ status: "signedOut" });
        }
      }
    })();
  }, [clearLocal, qc]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await client.login({
        email,
        password,
        deviceLabel: `FieldPulse ${Platform.OS} app`,
      });
      await tokenStore.set(res.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setToken(res.token);
      qc.setQueryData(queryKeys.me, res.user);
      setState({ status: "signedIn", user: res.user });
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    try {
      await client.logout();
    } catch {
      // Server-side revoke is best effort; local sign-out always proceeds.
    }
    await clearLocal();
  }, [clearLocal]);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useCurrentUser(): User {
  const { state } = useAuth();
  if (state.status !== "signedIn") throw new Error("No signed-in user");
  return state.user;
}
