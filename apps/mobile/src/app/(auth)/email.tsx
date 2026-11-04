import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "../../components/design/icon";
import { NativeStatus } from "../../components/ui/semantic";
import { TextField } from "../../components/ui/text-field";
import { App2Button } from "../../features/app2/app2-button";
import { HomaCharacter3D } from "../../features/app2/homa-character-3d";
import {
  checkEmailCode,
  normalizeEmail,
  sendEmailCode,
} from "../../features/auth/sign-in-code";
import { LegalLine } from "../../features/auth/legal-line";
import { useSession } from "../../features/auth/session-provider";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { supabase } from "../../lib/supabase";
import { colors, fontFamilies, fontSize, space } from "../../theme/app2";

/** Smaller than the front door's Homa, so the form still clears the keyboard. */
const HOMA_SIZE = 96;

/**
 * The email door: address, then a six digit code. Two steps in one route
 * rather than two routes, so the back gesture returns a parent to their
 * own address rather than dumping them at the front door to start again.
 *
 * Email codes remain the default. Existing-password sign-in is optional
 * for returning families and the App Review account (founder, 2026-10-05).
 *
 * Two rules this screen learned the hard way. Errors belong on the field
 * they describe, not floating in the layout, because a message 200pt
 * above an input is not attached to it for a screen reader or an eye.
 * And a confirmation that only announces is invisible: resending a code
 * changes no other pixel, so without a rendered status a sighted parent
 * taps and watches nothing happen. The first send moves to the code step,
 * whose subtitle already names the address, so that one only announces.
 *
 * App 2 look (gh#1236), matching the front door: white canvas, the 3D
 * Homa over a centered heading, ink controls, the form directly beneath
 * (founder ask 2026-11-03: centered, more professional). Fields keep the
 * shared primitive, whose darker boundary clears the 3:1 contrast floor.
 */
export default function EmailCodeScreen() {
  const { session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeShown, setNoticeShown] = useState(false);
  // Retapping resend with the same wording must still announce, so the
  // status gets a changing identity rather than relying on new text.
  const [noticeId, setNoticeId] = useState(0);
  useAccessibilityAnnouncement(notice && !noticeShown ? notice : null, noticeId);

  if (session) return <Redirect href="/" />;

  function announce(message: string, show: boolean) {
    setNotice(message);
    setNoticeShown(show);
    setNoticeId((current) => current + 1);
  }

  async function send(resending: boolean) {
    setPending(true);
    setError(null);
    const result = await sendEmailCode(email);
    setPending(false);

    if (result.status === "sent") {
      setStep("code");
      setCode("");
      announce(
        resending
          ? `A new code is on its way to ${normalizeEmail(email)}.`
          : `Code sent to ${normalizeEmail(email)}.`,
        resending,
      );
      return;
    }
    setNotice(null);
    if (result.status === "invalid-email") {
      setError("That address looks incomplete. Check it and try again.");
      return;
    }
    if (result.status === "rate-limited") {
      console.error("mobile email code rate limited:", result.reason);
      setError("That is a few too many for now. Try again in a few minutes.");
      return;
    }
    console.error("mobile email code send failed:", result.reason);
    setError(
      "Homa couldn't send that code. Nothing to fix on your end. Worth trying again in a moment.",
    );
  }

  async function check() {
    setPending(true);
    setError(null);
    const result = await checkEmailCode(email, code);
    setPending(false);

    // Success: SessionProvider picks up the session and this screen redirects.
    if (result.status === "signed-in") return;
    setNotice(null);
    if (result.status === "wrong-code") {
      setError("That code didn't match. Check the last email and try again.");
      return;
    }
    if (result.status === "expired") {
      setError("That code has expired. Send a fresh one and it will work.");
      return;
    }
    console.error("mobile email code check failed:", result.reason);
    setError(
      "Homa couldn't check that code. Nothing to fix on your end. Worth trying again in a moment.",
    );
  }

  async function signInWithPassword() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (authError || !data.session) {
        setError(authError?.status === 429
          ? "Too many attempts. Wait a few minutes, then try again."
          : "That email and password didn't match. Try again, or use an email code.");
        return;
      }
      setPassword("");
    } catch {
      setError("Couldn't connect. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const onEmailStep = step === "email";
  const textCentered = { textAlign: "center" as const };

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.page }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: space.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back sits at the top where a back control belongs. Below the
              legal line it read as part of the fine print, and this stack
              renders no header of its own to hold a chevron. */}
          <App2Button
            label={onEmailStep ? "Back" : "Use a different email"}
            variant="quiet"
            size="sm"
            icon={<Icon name="back" size={20} color={colors.textStrong} />}
            style={{ alignSelf: "flex-start", marginLeft: -space.sm }}
            disabled={pending}
            onPress={() => {
              if (onEmailStep) {
                router.back();
                return;
              }
              setStep("email");
              setError(null);
              setNotice(null);
            }}
          />

          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: space.md }} />

          <View style={{ alignItems: "center", gap: space.sm }}>
            <HomaCharacter3D size={HOMA_SIZE} />
            <Text
              accessibilityRole="header"
              style={{ ...textCentered, marginTop: space.xs, fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.xxl, color: colors.textStrong }}
            >
              {onEmailStep ? (usePassword ? "Welcome back." : "What's your email?") : "Check your email."}
            </Text>
            <Text style={{ ...textCentered, maxWidth: 320, fontFamily: fontFamilies.body, fontSize: fontSize.base, lineHeight: 22, color: colors.textMuted }}>
              {onEmailStep ? (
                usePassword
                  ? "Sign in with the password you already use for Homa."
                  : "Homa sends a six digit code. No password to make up, and none to forget later."
              ) : (
                // The address gets its own line: wrapped mid-sentence it
                // stranded "once." alone on the last line.
                <>
                  {"Six digits, sent to\n"}
                  <Text style={{ fontFamily: fontFamilies.bodySemibold, color: colors.textStrong }}>
                    {normalizeEmail(email)}
                  </Text>
                  {".\nIt works once."}
                </>
              )}
            </Text>
          </View>

          <View style={{ gap: space.sm, marginTop: space.xl, width: "100%", maxWidth: 440, alignSelf: "center" }}>
            {notice && noticeShown ? (
              <NativeStatus
                announce
                tone="info"
                label={notice}
                occurrenceId={noticeId}
              />
            ) : null}

            {onEmailStep ? (
              <>
                <TextField
                  style={{ backgroundColor: colors.card }}
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  error={error ?? undefined}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  returnKeyType="go"
                  onSubmitEditing={() => void (usePassword ? signInWithPassword() : send(false))}
                />
                {usePassword ? (
                  <TextField
                    style={{ backgroundColor: colors.card }}
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    textContentType="password"
                    editable={!pending}
                    returnKeyType="go"
                    onSubmitEditing={() => void signInWithPassword()}
                  />
                ) : null}
                <App2Button
                  label={pending ? (usePassword ? "Signing in…" : "Sending…") : (usePassword ? "Sign in" : "Send my code")}
                  size="lg"
                  style={{ marginTop: space.xs }}
                  onPress={() => void (usePassword ? signInWithPassword() : send(false))}
                  disabled={pending || (usePassword && (!email.trim() || !password))}
                  busy={pending}
                />
                <App2Button
                  label={usePassword ? "Use an email code instead" : "Use an existing password"}
                  variant="quiet"
                  size="sm"
                  disabled={pending}
                  onPress={() => {
                    setUsePassword(!usePassword);
                    setPassword("");
                    setError(null);
                    setNotice(null);
                  }}
                />
              </>
            ) : (
              <>
                <TextField
                  // A code reads as one object: large, centered, spaced digits.
                  style={{
                    backgroundColor: colors.card,
                    minHeight: 60,
                    textAlign: "center",
                    fontFamily: fontFamilies.bodySemibold,
                    fontSize: 28,
                    lineHeight: 34,
                    letterSpacing: 8,
                  }}
                  label="Six digit code"
                  value={code}
                  onChangeText={(next) =>
                    setCode(next.replace(/[^0-9]/gu, "").slice(0, 6))
                  }
                  error={error ?? undefined}
                  autoFocus
                  // oneTimeCode lets iOS offer the code straight from the
                  // notification banner, which is why it is in the subject.
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  keyboardType="number-pad"
                  // Spaced digits as a placeholder read as a code already filled in.
                  placeholder="······"
                  returnKeyType="go"
                  onSubmitEditing={() => void check()}
                />
                <App2Button
                  label={pending ? "Checking…" : "Let me in"}
                  size="lg"
                  style={{ marginTop: space.xs }}
                  onPress={() => void check()}
                  disabled={pending || code.length < 6}
                  busy={pending}
                />
                <App2Button
                  label="Send a new code"
                  variant="quiet"
                  size="sm"
                  onPress={() => void send(true)}
                  disabled={pending}
                />
              </>
            )}
          </View>

          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: space.lg }} />

          <LegalLine align="center" linkColor={colors.textStrong} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
