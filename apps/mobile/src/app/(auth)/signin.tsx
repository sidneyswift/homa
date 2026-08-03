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
  Text,
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
import { TextField } from "../../components/ui/text-field";
import { signInWithApple } from "../../features/auth/apple-sign-in";
import { signInWithGoogle } from "../../features/auth/google-sign-in";
import type { SignInFlowResult } from "../../features/auth/sign-in-result";
import { useSession } from "../../features/auth/session-provider";
import { env } from "../../lib/env";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { supabase } from "../../lib/supabase";
import { openWebOnboarding } from "../../lib/web-links";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, lineHeightFor, space } from "../../theme/tokens";

/**
 * Google, Apple, and email + password sign-in, matching the web /signin
 * flow and its ordering. Apple and Google can continue directly into the
 * native family setup gate; email account creation still starts on the web.
 */

/**
 * Turns a non-success Google or Apple result into what the parent
 * reads, or null to stay quiet. Two cases arrive here and they are not
 * the same: a parent who closed the sheet already knows why they are
 * back, while a parent whose sign-in failed is looking at a screen that
 * did nothing.
 *
 * TODO(founder): decide the copy and which cases speak. Voice laws in
 * AGENTS.md apply: reassure before inform, offers never commands, no
 * red or "failed" framing, no em dash.
 */
function describeSignInFailure(result: SignInFlowResult): string | null {
  if (result.status === "dismissed") return null;
  return "That didn't go through. You can try again when you're ready.";
}

export default function SignInScreen() {
  const { session } = useSession();
  const { fontScale } = useWindowDimensions();
  const bodyLineHeight = lineHeightFor(fontSize.base, fontScale);
  const smallLineHeight = lineHeightFor(fontSize.sm, fontScale);
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
    try {
      const result = await flow();
      // Success: SessionProvider picks up the session and this screen redirects.
      if (result.status === "signed-in") return;
      if (result.status === "failed") {
        console.error(`mobile ${provider} signin failed:`, result.reason);
      }
      setError(describeSignInFailure(result));
    } catch (cause) {
      console.error(`mobile ${provider} signin threw:`, cause);
      setError("That didn't go through. You can try again when you're ready.");
    } finally {
      setOauthPending(null);
    }
  }

  async function submit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Email and password are both needed.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInError) {
        console.error("mobile signin failed:", signInError.message);
        setError("That email and password didn't match. You can try again when you're ready.");
      }
    } catch (cause) {
      console.error("mobile signin threw:", cause);
      setError("We couldn't sign you in yet. You can try again when you're ready.");
    } finally {
      setPending(false);
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
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo },
      );
      if (resetError) {
        console.error("mobile password recovery request failed:", resetError.message);
        setError("We couldn't send the reset link. Try again in a minute.");
        return;
      }
      setRecoverySent(true);
    } catch (cause) {
      console.error("mobile password recovery threw:", cause);
      setError("We couldn't send the reset link. Try again in a minute.");
    } finally {
      setRecoveryPending(false);
    }
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
                lineHeight: bodyLineHeight,
                color: colors.textBody,
              }}
            >
              {"You've got this. Homa's got the rest."}
            </Text>
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
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.sm,
                  lineHeight: smallLineHeight,
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
            <Button
              label={recoveryPending ? "Sending link\u2026" : "Send reset link"}
              variant="ghost"
              onPress={() => void sendPasswordReset()}
              disabled={pending || oauthPending !== null || recoveryPending}
              busy={recoveryPending}
            />

            {recoverySent ? (
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.sm,
                  lineHeight: smallLineHeight,
                  color: colors.textBody,
                }}
              >
                {recoveryMessage}
              </Text>
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
            <Text
              style={{
                textAlign: "center",
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                lineHeight: smallLineHeight,
                color: colors.textMuted,
              }}
            >
              New to Homa? Apple or Google can take you straight into family setup. Email accounts start on the web.
            </Text>
            <Button
              label="Create an account on the web"
              variant="ghost"
              onPress={() => {
                void openWebOnboarding().catch((cause) => {
                  console.error("mobile web onboarding handoff failed:", cause);
                  setError("We couldn't open onboarding. Try again in a moment.");
                });
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
