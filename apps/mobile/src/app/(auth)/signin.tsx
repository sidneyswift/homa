import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as AppleAuthentication from "expo-apple-authentication";

import { GoogleGlyph } from "../../components/brand/google-glyph";
import { InlineError } from "../../components/ui/inline-error";
import { App2Button } from "../../features/app2/app2-button";
import { HomaCharacter3D } from "../../features/app2/homa-character-3d";
import { signInWithApple } from "../../features/auth/apple-sign-in";
import { signInWithGoogle } from "../../features/auth/google-sign-in";
import type { SignInFlowResult } from "../../features/auth/sign-in-result";
import { useSession } from "../../features/auth/session-provider";
import { signInFailureMessage } from "../../features/auth/sign-in-voice";
import { LegalLine } from "../../features/auth/legal-line";
import { colors, fontFamilies, fontSize, radius, space } from "../../theme/app2";

/**
 * Homa's size on the front door: close to the idle size she takes on the
 * App 2 conversation canvas, so signing in feels like the same room
 * rather than a new screen. Fixed rather than measured from the window,
 * which the #985 layout test forbids here.
 */
const HOMA_SIZE = 196;

/**
 * The front door AND the first impression, merged (founder direction
 * 2026-09-03; previously separate screens, hello.tsx and this one).
 * Three ways in, one screen, no distinction between a parent arriving
 * for the first time and one coming back: Apple and Google already
 * decide that themselves, and the email code resolves it server side.
 * Founder ruling 2026-08-18.
 *
 * App 2 look (gh#1236): the white canvas and the same 3D Homa the
 * conversation opens on, replacing the orange sky and flat mascot. Ink
 * on white, DM Sans throughout, the greeting centered under her.
 *
 * The greeting can't use a name here (nobody is signed in yet), so it
 * stays the generic form hello.tsx already used for that case: "Hi, I'm
 * Homa."
 *
 * Email codes are the default; the email screen also offers optional
 * existing-password sign-in. A forgotten password needs no reset here:
 * the parent can use a code. Setup stays in the app.
 *
 * Shape comes from a survey of 28 real iOS entry screens: eight of ten
 * comparable screens are a short list of doors rather than a credential
 * form. Founder direction 2026-09-03: no caption stating that the doors
 * serve new and returning parents alike, the doors already say that by
 * having no separate "sign up" path at all.
 *
 * The three doors are deliberately not equal weight, checked against
 * Headspace's own Log in / Sign up / Activate benefit stack and
 * Rosebud's Google+Apple / outlined-email pattern (Appllama, 2026-09-03):
 * Apple stays Apple's own mandated black button, Google stays an
 * outlined secondary door, and email steps back to a quiet text-weight
 * door, since it is the fallback path rather than a third equal provider.
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
      style={{ flex: 1, backgroundColor: colors.page }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingBottom: space.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Shrinkable top air (#985, 2026-08-18): at huge Dynamic Type
            sizes it yields its space to the taller greeting and doors
            instead of forcing an overflow, so content stays anchored at
            the scroll origin by ordinary flow at every text size. */}
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: space.md }} />

        <View style={{ alignItems: "center", gap: space.sm }}>
          <HomaCharacter3D size={HOMA_SIZE} />
          {/* Generic, not a name: nobody is signed in yet. */}
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.xxl,
              color: colors.textStrong,
              textAlign: "center",
            }}
          >
            {"Hi, I'm Homa."}
          </Text>
          {/* Founder direction 2026-09-09: the short promise belongs
              at sign-in; the benefits belong in the new-parent intro. */}
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textMuted,
              textAlign: "center",
            }}
          >
            {"Homeschool, handled."}
          </Text>
        </View>

        {/* The largest gap on the screen, and where the error lives. An
            error must eat empty space, never shove the doors down under
            a thumb that was already reaching for them. flexShrink: 1
            carries the same #985 guarantee as the top air above. */}
        <View
          style={{
            flexGrow: 1.4,
            flexShrink: 1,
            flexBasis: 0,
            minHeight: space.lg,
            justifyContent: "flex-end",
          }}
        >
          {error ? (
            <View style={{ marginBottom: space.md }}>
              <InlineError message={error} />
            </View>
          ) : null}
        </View>

        <View style={{ gap: 12 }}>
          {Platform.OS === "ios" ? (
            // Apple's own component, look untouched, first per guideline
            // 4.8. CONTINUE rather than SIGN_IN: this screen makes no
            // distinction, so "sign in" would be untrue for a new parent,
            // and it gives all three doors the same verb. Radius matches
            // the App 2 controls beside it.
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
              }
              buttonStyle={
                AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={radius.md}
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

          <App2Button
            label={
              oauthPending === "google"
                ? "Opening Google…"
                : "Continue with Google"
            }
            variant="secondary"
            icon={<GoogleGlyph />}
            onPress={() => void continueWith("google", signInWithGoogle)}
            disabled={signInBusy}
            busy={oauthPending === "google"}
          />

          {/* Quiet, not a third equal provider: Apple and Google are
              real accounts a parent already has; email is the fallback
              for a parent with neither, and every reference screen
              studied (Headspace, Rosebud, Duolingo ABC) steps its
              non-provider path down a visual tier (Appllama,
              2026-09-03). */}
          <App2Button
            label="Continue with email"
            variant="quiet"
            size="sm"
            accessibilityHint="Opens a step to enter your email, then a six digit code."
            onPress={() => router.push("/email")}
            disabled={signInBusy}
          />

          <LegalLine align="center" linkColor={colors.textStrong} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
