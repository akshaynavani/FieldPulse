import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { KeyValueStorage } from "@fieldpulse/core";

/** AsyncStorage adapter for the shared OfflineQueue. */
export const asyncStorageAdapter: KeyValueStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

const TOKEN_KEY = "fieldpulse.sessionToken";

/** Session tokens live in the Keychain / Keystore, never in AsyncStorage. */
export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
