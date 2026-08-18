import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import {
  NativeHeading,
  NativeStatus,
  NativeText,
} from "../../components/ui/semantic";
import { TextField } from "../../components/ui/text-field";
import {
  checkEmailCode,
  normalizeEmail,
  sendEmailCode,
} from "../../features/auth/email-code";
import { LegalLine } from "../../features/auth/legal-line";
import { useSession } from "../../features/auth/session-provider";
import { quietColors } from "../../theme/native-projection";

/**
 * The email door: address, then a six digit code. Two steps in one route
 * rather than two routes, so the back gesture returns a parent to their
 * own address rather than dumping them at the front door to start again.
 *
 * No password is asked for here or anywhere. A parent who already has
 * one is unaffected: a code does not care whether an account also has a
 * password.
 *
 * Two rules this screen learned the hard way. Errors belong on the field
 * they describe, not floating in the layout, because a message 200pt
 * above an input is not attached to it for a screen reader or an eye.
 * And a confirmation that only announces is invisible: resending a code
 * changes no other pixel, so without a rendered status a sighted parent
 * taps and watches nothing happen.
 */
export default function EmailCodeScreen() {
  const { session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Retapping resend with the same wording must still announce, so the
  // status gets a changing identity rather than relying on new text.
  const [noticeId, setNoticeId] = useState(0);

  if (session) return <Redirect href="/" />;

  function announce(message: string) {
    setNotice(message);
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

  const onEmailStep = step === "email";

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: quietColors.page }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back sits at the top where a back control belongs. Below the
              legal line it read as part of the fine print, and this stack
              renders no header of its own to hold a chevron. */}
          <Button
            label={onEmailStep ? "Back" : "Use a different email"}
            variant="ghost"
            size="sm"
            style={{ alignSelf: "flex-start" }}
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

          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 24 }} />

          <View style={{ gap: 16 }}>
            <NativeHeading level={2}>
              {onEmailStep ? "What's your email?" : "Check your email."}
            </NativeHeading>
            <NativeText role="body" tone="body">
              {onEmailStep
                ? "Homa sends a six digit code. No password to make up, and none to forget later."
                : `Six digits, sent to ${normalizeEmail(email)}. It works once.`}
            </NativeText>
          </View>

          <View
            style={{
              flexGrow: 1.6,
              flexShrink: 0,
              flexBasis: 0,
              minHeight: 24,
            }}
          />

          <View style={{ gap: 12 }}>
            {notice ? (
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
                  onSubmitEditing={() => void send(false)}
                />
                <Button
                  label={pending ? "Sending…" : "Send my code"}
                  size="lg"
                  onPress={() => void send(false)}
                  disabled={pending}
                  busy={pending}
                />
              </>
            ) : (
              <>
                <TextField
                  label="Six digit code"
                  value={code}
                  onChangeText={(next) =>
                    setCode(next.replace(/[^0-9]/gu, "").slice(0, 6))
                  }
                  error={error ?? undefined}
                  // oneTimeCode lets iOS offer the code straight from the
                  // notification banner, which is why it is in the subject.
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  keyboardType="number-pad"
                  placeholder="123456"
                  returnKeyType="go"
                  onSubmitEditing={() => void check()}
                />
                <Button
                  label={pending ? "Checking…" : "Let me in"}
                  size="lg"
                  onPress={() => void check()}
                  disabled={pending || code.length < 6}
                  busy={pending}
                />
                <Button
                  label="Send a new code"
                  variant="ghost"
                  size="sm"
                  style={{ alignSelf: "flex-start" }}
                  onPress={() => void send(true)}
                  disabled={pending}
                />
              </>
            )}

            <LegalLine />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
