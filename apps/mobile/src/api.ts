import { FieldPulseClient, isRetryable } from "@fieldpulse/api-client";
import { OfflineQueue } from "@fieldpulse/core";
import { asyncStorageAdapter } from "./storage";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

/** In-memory copy of the token so every request does not hit SecureStore. */
let currentToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setToken(token: string | null) {
  currentToken = token;
}

export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export const client = new FieldPulseClient({
  baseUrl: API_URL,
  getToken: () => currentToken,
  onUnauthorized: () => unauthorizedHandler?.(),
});

export const offlineQueue = new OfflineQueue(asyncStorageAdapter, {
  maxAttempts: 8,
  isRetryable,
});
