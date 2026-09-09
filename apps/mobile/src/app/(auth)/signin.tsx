import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import * as AppleAuthentication from "expo-apple-authentication";

import { GoogleGlyph } from "../../components/brand/google-glyph";
import { Button } from "../../components/ui/button";
import { InlineError } from "../../components/ui/inline-error";
import { NativeText } from "../../components/ui/semantic";
import { signInWithApple } from "../../features/auth/apple-sign-in";
import { signInWithGoogle } from "../../features/auth/google-sign-in";
import type { SignInFlowResult } from "../../features/auth/sign-in-result";
import { useSession } from "../../features/auth/session-provider";
import { signInFailureMessage } from "../../features/auth/sign-in-voice";
import { LegalLine } from "../../features/auth/legal-line";
import { HomaCharacter } from "../../features/voice/homa-character";
import { quietColors, quietRadii } from "../../theme/native-projection";

/**
 * The hero's fixed height: bounded on purpose (not "however tall the
 * mascot wants"), since this screen also has to fit the pitch text and
 * three sign-in doors below it without pushing them off-screen.
 *
 * Full-bleed, not a card: checked live against the actual Headspace
 * "Onboarding Welcome" screen this merge was modeled on (Appllama,
 * 2026-09-03) and its sky runs edge to edge and behind the status bar,
 * with a mascot that dominates the top third. The first build of this
 * merge kept a rounded, margined gradient card instead, which reads
 * closer to a banner than a backdrop. SafeAreaView below only insets
 * "bottom" so this block can sit behind the Dynamic Island the same way.
 */
const HERO_HEIGHT = 260;
const HERO_CHARACTER_SIZE = 150;

/**
 * The front door AND the first impression, merged (founder direction
 * 2026-09-03; previously separate screens, hello.tsx and this one).
 * Three ways in, one screen, no distinction between a parent arriving
 * for the first time and one coming back: Apple and Google already
 * decide that themselves, and the email code resolves it server side.
 * Founder ruling 2026-08-18.
 *
 * The greeting can't use a name here (nobody is signed in yet), so it
 * stays the generic form hello.tsx already used for that case: "Hi, I'm
 * Homa." The mascot and sky are rendered directly rather than through
 * WalkScene/WalkCharacterProvider: those exist for the persistent,
 * animated-between-screens stage inside the signed-in-only (onboarding)
 * walk, and this is a single pre-auth screen with nothing to persist
 * across.
 *
 * There is no password anywhere in this app, so there is nothing to
 * recover and no reset action competing with the way in. There is also
 * no route out to the web: setup finishes here.
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
 * Apple stays Apple's own mandated black button, Google stays a filled
 * secondary door, and email steps back to a quiet text-weight door,
 * since it is the fallback path rather than a third equal provider.
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
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: quietColors.page }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Full-bleed hero: edge to edge and behind the status bar /
            Dynamic Island, not a margined card (see HERO_HEIGHT above). */}
        <View style={{ height: HERO_HEIGHT }}>
          <Svg
            pointerEvents="none"
            width="100%"
            height="100%"
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <Defs>
              <LinearGradient id="signinSky" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#F2703A" />
                <Stop offset="0.46" stopColor="#F7BE6E" />
                <Stop offset="0.78" stopColor="#FBE8DF" />
                <Stop offset="1" stopColor={quietColors.page} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#signinSky)" />
          </Svg>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              alignItems: "center",
              paddingBottom: 6,
            }}
          >
            <HomaCharacter state="idle" size={HERO_CHARACTER_SIZE} act={null} />
          </View>
        </View>

        <View
          style={{
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 24,
          }}
        >
          <View style={{ gap: 16 }}>
            {/* Generic, not a name: nobody is signed in yet. Matches
                hello.tsx's own no-name fallback line, since it's the same
                sentence for the same reason now. */}
            <NativeText role="display" tone="strong" style={{ fontSize: 32, lineHeight: 40 }}>
              {"Hi, I'm Homa."}
            </NativeText>
            {/* Founder direction 2026-09-09: the short promise belongs
                at sign-in; the benefits belong in the new-parent intro. */}
            <NativeText role="body" tone="strong">
              {"Homeschool, handled."}
            </NativeText>
          </View>

          {/* The largest gap on the screen, and where the error lives. An
              error must eat empty space, never shove the doors down under
              a thumb that was already reaching for them. Headspace's own
              reference screen carries a comparably large gap here too
              (Appllama, 2026-09-03): a big gap below short copy is a
              pattern this category already uses, not a hole to fill in.
              flexShrink: 1 carries forward the #985 fix (2026-08-18): at
              huge Dynamic Type sizes this spacer yields its space back to
              the now-taller headline/pitch/buttons instead of forcing an
              overflow, the same structural guarantee the old top-air
              spacer gave the previous version of this screen. */}
          <View
            style={{
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: 0,
              minHeight: 24,
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

            {/* Quiet, not a third equal provider: Apple and Google are
                real accounts a parent already has; email is the fallback
                for a parent with neither, and every reference screen
                studied (Headspace, Rosebud, Duolingo ABC) steps its
                non-provider path down a visual tier instead of matching
                the providers' own weight (Appllama, 2026-09-03). Smallest
                size on the scale, not "lg" like the doors above it: a
                transparent button at door-height left a tall dead box
                around the text once it lost its fill and border. */}
            <Button
              label="Continue with email"
              variant="ghost"
              size="sm"
              accessibilityHint="Opens a step to enter your email, then a six digit code."
              onPress={() => router.push("/email")}
              disabled={signInBusy}
            />

            <LegalLine />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
