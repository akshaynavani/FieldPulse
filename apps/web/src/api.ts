import { FieldPulseClient } from "@fieldpulse/api-client";

const TOKEN_KEY = "fieldpulse.sessionToken";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let unauthorizedHandler: (() => void) | null = null;
export const onUnauthorized = (fn: () => void) => {
  unauthorizedHandler = fn;
};

export const client = new FieldPulseClient({
  baseUrl: API_URL,
  getToken: tokenStore.get,
  onUnauthorized: () => unauthorizedHandler?.(),
});
