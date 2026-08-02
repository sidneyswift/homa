import type { MobileBootstrapFailureReason } from "@homa/core";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import {
  getMyConsentStatus,
  recordAiProcessingConsent,
} from "../lib/family";
import { useSession } from "../features/auth/session-provider";
import { reportBootstrapEvent } from "../features/bootstrap/bootstrap-events";
import { runMobileBootstrapStep } from "../features/bootstrap/mobile-bootstrap";
import { openPrivacyPolicy } from "../lib/web-links";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { InlineError } from "./ui/inline-error";
import { LoadingStatus } from "./ui/loading-status";

/**
 * App Review 5.1.2(i): explicit, affirmative consent before family data
 * reaches Homa, the moment it becomes true, an AI experience, not sign-in
 * (a family mid web onboarding has nothing going to Homa yet either).
 * Renders the disclosure in place until the signed-in adult agrees, then
 * passes through. Record lives on family_members
 * (supabase/migrations/20260728190000_ai_processing_consent.sql), not a
 * local flag, so it survives reinstalls and is auditable.
 */
export function AiConsentGate({
  children,
  purpose = "chat",
  embedded = false,
}: {
  children: ReactNode;
  purpose?: "chat" | "progress";
  embedded?: boolean;
}) {
  const [status, setStatus] =
    useState<"loading" | "failed" | "needed" | "given">("loading");
  const [failureReason, setFailureReason] =
    useState<MobileBootstrapFailureReason | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const previousFailureRef = useRef<MobileBootstrapFailureReason | null>(null);
  const { continueSignedOut } = useSession();

  const loadConsent = useCallback(async () => {
    const attempt = ++attemptRef.current;
    void reportBootstrapEvent("attempted", "consent");
    setStatus("loading");
    setFailureReason(null);
    const result = await runMobileBootstrapStep("consent", getMyConsentStatus);
    if (attempt !== attemptRef.current) return;
    if (result.ok) {
      const recoveredFrom = previousFailureRef.current;
      previousFailureRef.current = null;
      setStatus(result.value ? "given" : "needed");
      if (recoveredFrom) {
        void reportBootstrapEvent("recovered", "consent", recoveredFrom);
      }
      return;
    }
    previousFailureRef.current = result.reason;
    setFailureReason(result.reason);
    setStatus("failed");
    void reportBootstrapEvent("failed", "consent", result.reason);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadConsent(), 0);
    return () => {
      clearTimeout(timer);
    };
  }, [loadConsent]);

  async function handleAgree() {
    void reportBootstrapEvent("attempted", "consent");
    setSaving(true);
    setErrorMessage(null);
    const result = await runMobileBootstrapStep(
      "consent",
      recordAiProcessingConsent,
    );
    if (result.ok) {
      setStatus("given");
      const recoveredFrom = previousFailureRef.current;
      previousFailureRef.current = null;
      if (recoveredFrom) {
        void reportBootstrapEvent("recovered", "consent", recoveredFrom);
      }
    } else {
      previousFailureRef.current = result.reason;
      void reportBootstrapEvent("failed", "consent", result.reason);
      setErrorMessage("That didn't go through. You can try again when you're ready.");
    }
    setSaving(false);
  }

  if (status === "loading") {
    return <LoadingStatus label="Checking your privacy choice" style={{ marginTop: space.xl }} />;
  }

  if (status === "given") {
    return <>{children}</>;
  }

  if (status === "failed") {
    return (
      <View style={embedded ? undefined : { padding: space.lg }}>
        <Card style={{ gap: space.md }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.lg,
              color: colors.textStrong,
            }}
          >
            Your privacy choice is safe
          </Text>
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textBody,
            }}
          >
            {failureReason === "expired_session"
              ? "Your sign-in has expired. Sign in again before sharing anything with Homa."
              : "We could not check your choice. Nothing has been shared with Homa."}
          </Text>
          <Button label="Try again" onPress={() => void loadConsent()} />
          {failureReason === "expired_session" ? (
            <Button
              label="Continue to sign in"
              variant="secondary"
              onPress={continueSignedOut}
            />
          ) : null}
        </Card>
      </View>
    );
  }

  return (
    <View style={embedded ? undefined : { padding: space.lg }}>
      <Card style={{ gap: space.md }}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fontFamilies.displaySemibold,
            fontSize: fontSize.lg,
            color: colors.textStrong,
          }}
        >
          {purpose === "progress"
            ? "Before Homa suggests a next move"
            : "Before you chat with Homa"}
        </Text>
        <Text
          style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
        >
          {
            "What you and your kids share here, including what you write and your family's details, is processed by outside AI providers so Homa can help. We never sell it."
          }
        </Text>
        <Button
          label="Read the privacy policy"
          variant="ghost"
          onPress={() => void openPrivacyPolicy()}
        />
        {errorMessage ? <InlineError message={errorMessage} /> : null}
        <Button
          label={
            saving
              ? "One moment\u2026"
              : purpose === "progress"
                ? "I agree, show suggestions"
                : "I agree, let's chat"
          }
          onPress={() => void handleAgree()}
          disabled={saving}
        />
      </Card>
    </View>
  );
}
