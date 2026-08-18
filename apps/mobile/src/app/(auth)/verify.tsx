import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
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

/** The six-digit check for the email door. Success lands like any other
 *  sign-in: SessionProvider sees the session and the app takes over. */
export default function VerifyScreen() {
  const router = useRouter();
  const { session } = useSession();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;
  if (!email) return <Redirect href="/email" />;

  async function verify() {
    const token = code.replace(/\D/gu, "");
    if (token.length !== 6) {
      setError("The code is six digits.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    setPending(false);
    if (verifyError) {
      console.error("mobile email code verify failed:", verifyError.message);
      setError("That code didn't match. Check the newest email and try again.");
    }
    // Success: SessionProvider picks up the session and this screen redirects.
  }

  async function resend() {
    setResending(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setResending(false);
    if (otpError) {
      setError("The code didn't send. Try again in a minute.");
    }
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
            Check your email
          </NativeText>
          <NativeText role="body" tone="body">
            {`I sent a six-digit code to ${email}.`}
          </NativeText>
          <TextField
            label="Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            placeholder="000000"
          />
          {error ? <InlineError message={error} /> : null}
          <Button
            label={pending ? "One moment…" : "Continue"}
            size="lg"
            onPress={() => void verify()}
            disabled={pending || resending}
            busy={pending}
          />
          <Button
            label={resending ? "Sending again…" : "Send a new code"}
            variant="ghost"
            onPress={() => void resend()}
            disabled={pending || resending}
            busy={resending}
          />
          <Button
            label="Use a different email"
            variant="ghost"
            onPress={() => router.back()}
            disabled={pending || resending}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
