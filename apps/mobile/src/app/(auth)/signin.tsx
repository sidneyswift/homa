import {
  normalizePasswordRecoveryEmail,
  passwordRecoveryRedirectUrl,
} from "@homa/core";
import { Redirect } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as AppleAuthentication from "expo-apple-authentication";

import { GoogleGlyph } from "../../components/brand/google-glyph";
import { Logo } from "../../components/brand/logo";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { InlineError } from "../../components/ui/inline-error";
import { NativeText } from "../../components/ui/semantic";
import { TextField } from "../../components/ui/text-field";
import { signInWithApple } from "../../features/auth/apple-sign-in";
import { signInWithGoogle } from "../../features/auth/google-sign-in";
import type { SignInFlowResult } from "../../features/auth/sign-in-result";
import { useSession } from "../../features/auth/session-provider";
import { signInFailureMessage } from "../../features/auth/sign-in-voice";
import { env } from "../../lib/env";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { supabase } from "../../lib/supabase";
import { openWebOnboarding } from "../../lib/web-links";
import { colors, space } from "../../theme/tokens";

/**
 * Apple, Google, and email + password sign-in. Account creation stays
 * behind the web onboarding entry, so every door gathers the same setup
 * context before a family reaches the app.
 *
 * Web is the reference for ordering and weight, not a mirror. Two things
 * differ on purpose: Apple sits first because guideline 4.8 wants it no
 * less prominent than Google, and web has no Apple door at all. Password
 * recovery is inline here rather than web's separate /forgot-password
 * page, so it carries web's visual weight instead: a quiet, content
 * width action, never a second full width button above Sign in.
 */

export default function SignInScreen() {
  const { session } = useSession();
  const { fontScale } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [oauthPending, setOauthPending] = useState<"google" | "apple" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const recoveryMessage = recoverySent
    ? "If that email is connected to Homa, a reset link is on its way. It may take a minute."
    : null;
  useAccessibilityAnnouncement(recoveryMessage);
  const signInBusy = oauthPending !== null || pending;

  if (session) return <Redirect href="/" />;

  async function continueWith(
    provider: "google" | "apple",
    flow: () => Promise<SignInFlowResult>,
  ) {
    setError(null);
    setOauthPending(provider);
    const result = await flow();
    setOauthPending(null);
    // Success: SessionProvider picks up the session and this screen redirects.
    if (result.status === "signed-in") return;
    // Quiet for the parent is never quiet in the logs. A declined result
    // shows them nothing, so this line is the only trace it happened.
    if (result.status === "failed" || result.status === "provider-declined") {
      console.error(`mobile ${provider} signin ${result.status}:`, result.reason);
    }
    setError(signInFailureMessage(result));
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
              {"You've got this. Homa's got the rest."}
            </NativeText>
          </View>

          <Card style={{ gap: space.md }}>
            {Platform.OS === "ios" ? (
              // Apple's own button component, required look per their
              // branding rules; height and width must be explicit or it
              // does not render. Sits first: guideline 4.8 wants it no
              // less prominent than Google.
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={26}
                accessibilityLabel="Continue with Apple"
                accessibilityState={{
                  disabled: signInBusy,
                  busy: oauthPending === "apple",
                }}
                pointerEvents={signInBusy ? "none" : "auto"}
                style={{ width: "100%", height: 52, opacity: signInBusy ? 0.55 : 1 }}
                onPress={() => {
                  if (oauthPending || pending) return;
                  void continueWith("apple", signInWithApple);
                }}
              />
            ) : null}
            <Button
              label={
                oauthPending === "google"
                  ? "Opening Google\u2026"
                  : "Continue with Google"
              }
              variant="secondary"
              size="lg"
              icon={<GoogleGlyph />}
              onPress={() => void continueWith("google", signInWithGoogle)}
              disabled={signInBusy}
              busy={oauthPending === "google"}
            />

            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.borderSubtle }} />
              <NativeText role="caption" tone="muted">
                or
              </NativeText>
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
            {/* Content width and right aligned, the shape web gives the
                same action (apps/web/app/signin/signin-form.tsx, a small
                "Forgot password?" link under the password field). Full
                width here stacked two same-weight actions and the quiet
                one sat on top, so recovery read as loud as signing in.
                size="sm" is the smallest tier that still clears the 44pt
                tap target, so the weight drops without the target. */}
            <Button
              label={recoveryPending ? "Sending link\u2026" : "Send reset link"}
              variant="ghost"
              size="sm"
              style={{ alignSelf: "flex-end" }}
              onPress={() => void sendPasswordReset()}
              disabled={pending || oauthPending !== null || recoveryPending}
              busy={recoveryPending}
            />

            {recoverySent ? (
              <NativeText role="bodySmall" tone="body">
                {recoveryMessage}
              </NativeText>
            ) : null}

            {error ? <InlineError message={error} /> : null}

            <Button
              label={pending ? "One moment\u2026" : "Sign in"}
              onPress={() => void submit()}
              disabled={pending || oauthPending !== null || recoveryPending}
              busy={pending}
              size="lg"
            />
          </Card>

          <View style={{ gap: space.sm }}>
            <NativeText role="bodySmall" tone="muted" style={{ textAlign: "center" }}>
              New to Homa? Start with the web onboarding, then sign in here.
            </NativeText>
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
