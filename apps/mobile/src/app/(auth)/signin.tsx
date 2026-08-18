import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as AppleAuthentication from "expo-apple-authentication";

import { GoogleGlyph } from "../../components/brand/google-glyph";
import { Logo } from "../../components/brand/logo";
import { Button } from "../../components/ui/button";
import { InlineError } from "../../components/ui/inline-error";
import { NativeText } from "../../components/ui/semantic";
import { signInWithApple } from "../../features/auth/apple-sign-in";
import { signInWithGoogle } from "../../features/auth/google-sign-in";
import type { SignInFlowResult } from "../../features/auth/sign-in-result";
import { useSession } from "../../features/auth/session-provider";
import { colors, space } from "../../theme/tokens";

/**
 * The door (mobile onboarding v1, wireframe v4 step 1, founder ruling
 * 2026-08-18): the promise and the account are ONE screen. No button
 * that only leads to more buttons. Apple first (guideline 4.8), Google
 * second, an email code path for everyone else, and a quiet line for
 * returning password accounts. New accounts never create a password.
 * The old eject to web onboarding is gone: mobile-born accounts get
 * their family from the onboarding bootstrap right after this door.
 */
function describeSignInFailure(result: SignInFlowResult): string | null {
  if (result.status === "dismissed") return null;
  return "That didn't go through. You can try again when you're ready.";
}

export default function SignInScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [oauthPending, setOauthPending] = useState<"google" | "apple" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const signInBusy = oauthPending !== null;

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
    if (result.status === "failed") {
      console.error(`mobile ${provider} signin failed:`, result.reason);
    }
    setError(describeSignInFailure(result));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: space.lg,
          gap: space.xl,
        }}
      >
        <View style={{ alignItems: "center", gap: space.md }}>
          <Logo size={56} />
          <NativeText
            role="display"
            tone="strong"
            style={{ textAlign: "center" }}
          >
            {"You've got this.\nHoma's got the rest."}
          </NativeText>
        </View>

        <View style={{ gap: space.sm }}>
          {Platform.OS === "ios" ? (
            // Apple's own button component, required look per their
            // branding rules; height and width must be explicit or it
            // does not render. Sits first: guideline 4.8 wants it no
            // less prominent than Google.
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
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
                if (oauthPending) return;
                void continueWith("apple", signInWithApple);
              }}
            />
          ) : null}
          <Button
            label={
              oauthPending === "google"
                ? "Opening Google…"
                : "Continue with Google"
            }
            variant="secondary"
            size="lg"
            icon={<GoogleGlyph />}
            onPress={() => void continueWith("google", signInWithGoogle)}
            disabled={signInBusy}
            busy={oauthPending === "google"}
          />
          <Button
            label="Use email instead"
            variant="ghost"
            onPress={() => router.push("/email" as never)}
            disabled={signInBusy}
          />

          {error ? <InlineError message={error} /> : null}
        </View>

        <View style={{ gap: space.xs }}>
          <Button
            label="I already have an account with a password"
            variant="ghost"
            onPress={() => router.push("/password" as never)}
            disabled={signInBusy}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
