import { Redirect } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GoogleGlyph } from "../../components/brand/google-glyph";
import { Logo } from "../../components/brand/logo";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { TextField } from "../../components/ui/text-field";
import {
  signInWithGoogle,
  type GoogleSignInResult,
} from "../../features/auth/google-sign-in";
import { useSession } from "../../features/auth/session-provider";
import { supabase } from "../../lib/supabase";
import { openWebOnboarding } from "../../lib/web-links";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * Google and email + password sign-in, matching the web /signin flow and
 * its ordering. Account creation stays behind the web onboarding entry,
 * so every door gathers the same setup context before a family reaches
 * the app.
 */

/**
 * Turns a non-success Google result into what the parent reads, or null
 * to stay quiet. Two cases arrive here and they are not the same: a
 * parent who closed the browser already knows why they are back, while a
 * parent whose exchange failed is looking at a screen that did nothing.
 *
 * TODO(founder): decide the copy and which cases speak. Voice laws in
 * AGENTS.md apply: reassure before inform, offers never commands, no
 * red or "failed" framing, no em dash.
 */
function describeGoogleFailure(result: GoogleSignInResult): string | null {
  if (result.status === "dismissed") return null;
  return "That didn't go through. You can try again when you're ready.";
}

export default function SignInScreen() {
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  async function continueWithGoogle() {
    setError(null);
    setGooglePending(true);
    const result = await signInWithGoogle();
    setGooglePending(false);
    // Success: SessionProvider picks up the session and this screen redirects.
    if (result.status === "signed-in") return;
    if (result.status === "failed") {
      console.error("mobile google signin failed:", result.reason);
    }
    setError(describeGoogleFailure(result));
  }

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: space.lg,
            gap: space.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", gap: space.md }}>
            <Logo size={44} />
            <Text
              style={{
                textAlign: "center",
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              {"You've got this. Homa's got the rest."}
            </Text>
          </View>

          <Card style={{ gap: space.md }}>
            <Button
              label={googlePending ? "Opening Google\u2026" : "Continue with Google"}
              variant="secondary"
              size="lg"
              icon={<GoogleGlyph />}
              onPress={() => void continueWithGoogle()}
              disabled={googlePending || pending}
            />

            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.borderSubtle }} />
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.sm,
                  color: colors.textMuted,
                }}
              >
                or
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.borderSubtle }} />
            </View>

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

            {error ? (
              <Text
                accessibilityRole="alert"
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.sm,
                  color: colors.danger,
                }}
              >
                {error}
              </Text>
            ) : null}

            <Button
              label={pending ? "One moment\u2026" : "Sign in"}
              onPress={() => void submit()}
              disabled={pending || googlePending}
              size="lg"
            />
          </Card>

          <View style={{ gap: space.sm }}>
            <Text
              style={{
                textAlign: "center",
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                color: colors.textMuted,
              }}
            >
              New to Homa? Start with the web onboarding, then sign in here.
            </Text>
            <Button
              label="Open onboarding"
              variant="ghost"
              onPress={() => void openWebOnboarding()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
