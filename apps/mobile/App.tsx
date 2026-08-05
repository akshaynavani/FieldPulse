import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { isRetryable } from "@fieldpulse/api-client";
import { ApiProvider } from "@fieldpulse/hooks";
import { client, offlineQueue } from "./src/api";
import { AuthProvider } from "./src/auth";
import { RootNavigator } from "./src/navigation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Keep cached data around for offline browsing during the day.
      gcTime: 24 * 60 * 60_000,
      retry: (count, err) => count < 3 && isRetryable(err),
    },
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={client} offlineQueue={offlineQueue}>
          <AuthProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </AuthProvider>
        </ApiProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
