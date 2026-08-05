import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { ApiError } from "@fieldpulse/api-client";
import { LoginRequestSchema } from "@fieldpulse/contracts";
import { useAuth } from "../auth";
import { Button } from "../components/ui";
import { colors, shared, spacing } from "../theme";

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    // Same Zod schema the server uses, so field errors show before any request.
    const parsed = LoginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[shared.screen, { justifyContent: "center", padding: spacing(6) }]}
    >
      <View style={{ gap: spacing(3) }}>
        <Text style={[shared.h1, { fontSize: 32 }]}>FieldPulse</Text>
        <Text style={shared.muted}>Sign in to see today's route and pipeline.</Text>
        <TextInput
          style={shared.input}
          placeholder="Work email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={shared.input}
          placeholder="Password"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        <Button title="Sign in" onPress={submit} loading={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}
