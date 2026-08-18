import {
  normalizePasswordRecoveryEmail,
  passwordRecoveryRedirectUrl,
} from "@homa/core";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "../../components/brand/logo";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { InlineError } from "../../components/ui/inline-error";
import { NativeText } from "../../components/ui/semantic";
import { TextField } from "../../components/ui/text-field";
import { useSession } from "../../features/auth/session-provider";
import { env } from "../../lib/env";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { supabase } from "../../lib/supabase";
import { colors, space } from "../../theme/tokens";

/**
 * The returning-account door: email + password with recovery, moved off
 * the front door when it became the promise + one-tap screen (mobile
 * onboarding v1). New accounts never come here; they use Apple, Google,
 * or the email code. This screen exists for every account created
 * before codes, and for recovery.
 */
export default function PasswordSignInScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { fontScale } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recoveryMessage = recoverySent
    ? "If that email is connected to Homa, a reset link is on its way. It may take a minute."
    : null;
  useAccessibilityAnnouncement(recoveryMessage);

  if (session) return <Redirect href="/" />;

  async function submit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Email and password are both needed.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setPending(false);
    if (signInError) {
      console.error("mobile signin failed:", signInError.message);
      setError("That email and password didn't match. You can try again when you're ready.");
    }
    // Success: SessionProvider picks up the session and this screen redirects.
  }

  async function sendPasswordReset() {
    const normalizedEmail = normalizePasswordRecoveryEmail(email);
    if (!normalizedEmail) {
      setError("Enter your email above, then tap Send reset link.");
      return;
    }
    const redirectTo = passwordRecoveryRedirectUrl(env.apiUrl);
    if (!redirectTo) {
      setError("We couldn't send the reset link. Try again in a minute.");
      return;
    }

    setRecoveryPending(true);
    setRecoverySent(false);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo },
    );
    setRecoveryPending(false);

    if (resetError) {
      console.error("mobile password recovery request failed:", resetError.message);
      setError("We couldn't send the reset link. Try again in a minute.");
      return;
    }

    setRecoverySent(true);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: fontScale >= 2 ? "flex-start" : "center",
            padding: space.lg,
            gap: space.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", gap: space.md }}>
            <Logo size={44} />
            <NativeText role="body" tone="body" style={{ textAlign: "center" }}>
              Welcome back.
            </NativeText>
          </View>

          <Card style={{ gap: space.md }}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
            />
            <Button
              label={recoveryPending ? "Sending link…" : "Send reset link"}
              variant="ghost"
              onPress={() => void sendPasswordReset()}
              disabled={pending || recoveryPending}
              busy={recoveryPending}
            />

            {recoverySent ? (
              <NativeText role="bodySmall" tone="body">
                {recoveryMessage}
              </NativeText>
            ) : null}

            {error ? <InlineError message={error} /> : null}

            <Button
              label={pending ? "One moment…" : "Sign in"}
              onPress={() => void submit()}
              disabled={pending || recoveryPending}
              busy={pending}
              size="lg"
            />
          </Card>

          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
