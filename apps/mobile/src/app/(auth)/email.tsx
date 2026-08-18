import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { InlineError } from "../../components/ui/inline-error";
import { NativeText } from "../../components/ui/semantic";
import { TextField } from "../../components/ui/text-field";
import { useSession } from "../../features/auth/session-provider";
import { supabase } from "../../lib/supabase";
import { colors, space } from "../../theme/tokens";

/**
 * The email door: address in, six-digit code back, no password ever
 * (mobile onboarding v1, R2). shouldCreateUser makes this the signup
 * path too; Supabase's email template must carry the OTP token for the
 * code to arrive (deployment note in the v1 plan).
 */
export default function EmailScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  async function sendCode() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter your email and I'll send you a code.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    setPending(false);
    if (otpError) {
      console.error("mobile email code request failed:", otpError.message);
      setError("The code didn't send. Try again in a minute.");
      return;
    }
    router.push({ pathname: "/verify", params: { email: trimmed } } as never);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: space.lg,
            gap: space.md,
          }}
        >
          <NativeText role="display" tone="strong">
            {"What's your email?"}
          </NativeText>
          <NativeText role="body" tone="body">
            {"I'll send a six-digit code. No password to invent, ever."}
          </NativeText>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          {error ? <InlineError message={error} /> : null}
          <Button
            label={pending ? "Sending code…" : "Send my code"}
            size="lg"
            onPress={() => void sendCode()}
            disabled={pending}
            busy={pending}
          />
          <Button
            label="Back"
            variant="ghost"
            onPress={() => router.back()}
            disabled={pending}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
