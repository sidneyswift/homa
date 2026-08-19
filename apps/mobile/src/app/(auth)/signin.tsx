import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as AppleAuthentication from "expo-apple-authentication";

import { GoogleGlyph } from "../../components/brand/google-glyph";
import { Button } from "../../components/ui/button";
import { InlineError } from "../../components/ui/inline-error";
import {
  NativeHeading,
  NativeIdentity,
  NativeText,
} from "../../components/ui/semantic";
import { signInWithApple } from "../../features/auth/apple-sign-in";
import { signInWithGoogle } from "../../features/auth/google-sign-in";
import type { SignInFlowResult } from "../../features/auth/sign-in-result";
import { useSession } from "../../features/auth/session-provider";
import { signInFailureMessage } from "../../features/auth/sign-in-voice";
import { LegalLine } from "../../features/auth/legal-line";
import { quietColors, quietRadii } from "../../theme/native-projection";

/**
 * The front door. Three ways in, one screen, no distinction between a
 * parent arriving for the first time and one coming back: Apple and
 * Google already decide that themselves, and the email code resolves it
 * server side. Founder ruling 2026-08-18.
 *
 * There is no password anywhere in this app, so there is nothing to
 * recover and no reset action competing with the way in. There is also
 * no route out to the web: setup finishes here.
 *
 * Shape comes from a survey of 28 real iOS entry screens. Two findings
 * drive it. Eight of ten comparable screens are a short list of doors
 * rather than a credential form, and every one of them says somewhere
 * that the single screen serves new and returning people both. The
 * caption above the doors is that sentence and it is dry on purpose:
 * the screen's charm is spent on the line above the fold, and a second
 * memorable sentence would only compete with the first.
 *
 * Values come from the contract via native-projection. Not tokens.ts,
 * which apps/mobile/CLAUDE.md freezes as a compatibility export.
 */
export default function SignInScreen() {
  const { session } = useSession();
  const router = useRouter();
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
    // Quiet for the parent is never quiet in the logs. A declined result
    // shows them nothing, so this line is the only trace it happened.
    if (result.status === "failed" || result.status === "provider-declined") {
      console.error(`mobile ${provider} signin ${result.status}:`, result.reason);
    }
    setError(signInFailureMessage(result));
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: quietColors.page }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top air. May shrink so the voice block never leaves the screen. */}
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 24 }} />

        <View style={{ gap: 16 }}>
          <NativeIdentity variant="mark" size={48} />
          {/* Founder line, 2026-08-18. Two words carry the whole screen,
              so it takes level 1 rather than level 2: at 28pt a line this
              short stops holding the composition and the canvas above it
              reads as a page that failed to load.

              The glyph rather than the lockup, because this line does not
              spell Homa and the mark is the only place the name appears
              before a parent taps. */}
          <NativeHeading level={1}>Homeschool, handled.</NativeHeading>
        </View>

        {/* The largest gap on the screen, and where the error lives. An
            error must eat empty space, never shove the doors down under
            a thumb that was already reaching for them. */}
        <View
          style={{
            flexGrow: 1.6,
            flexShrink: 0,
            flexBasis: 0,
            minHeight: 40,
            justifyContent: "flex-end",
          }}
        >
          {error ? (
            <View style={{ marginBottom: 16 }}>
              <InlineError message={error} />
            </View>
          ) : null}
        </View>

        <View style={{ gap: 12 }}>
          {/* "any of these" rather than "all three": the Apple door is
              iOS only, and the sentence has to stay true on Android. */}
          <NativeText role="caption" tone="muted">
            New here or coming back, any of these gets you in.
          </NativeText>

          {Platform.OS === "ios" ? (
            // Apple's own component, look untouched, first per guideline
            // 4.8. CONTINUE rather than SIGN_IN: this screen makes no
            // distinction, so "sign in" would be untrue for a new parent,
            // and it gives all three doors the same verb. Radius is the
            // contract's control radius; the old 26 made a pill sitting
            // on two 12-radius neighbours.
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
              }
              buttonStyle={
                AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={quietRadii.control}
              accessibilityLabel="Continue with Apple"
              accessibilityState={{
                disabled: signInBusy,
                busy: oauthPending === "apple",
              }}
              pointerEvents={signInBusy ? "none" : "auto"}
              style={{ width: "100%", height: 52, opacity: signInBusy ? 0.55 : 1 }}
              onPress={() => {
                if (signInBusy) return;
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

          {/* Same weight as Google, and no mail glyph. The only thing
              separating the two is Google's own mandated mark, which is
              Google's requirement rather than a demotion Homa applied.
              Email is the one route for a parent with neither account,
              which skews least technical, so it never becomes a control
              that does not look like a control. */}
          <Button
            label="Continue with email"
            variant="secondary"
            size="lg"
            accessibilityHint="Opens a step to enter your email, then a six digit code."
            onPress={() => router.push("/email")}
            disabled={signInBusy}
          />

          <LegalLine />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
