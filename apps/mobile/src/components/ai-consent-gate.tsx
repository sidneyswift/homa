import type { MobileBootstrapFailureReason } from "@homa/core";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getMyConsentStatus,
  recordAiProcessingConsent,
} from "../lib/family";
import { App2Button } from "../features/app2/app2-button";
import { HomaCharacter3D } from "../features/app2/homa-character-3d";
import { useSession } from "../features/auth/session-provider";
import { reportBootstrapEvent } from "../features/bootstrap/bootstrap-events";
import { runMobileBootstrapStep } from "../features/bootstrap/mobile-bootstrap";
import { openPrivacyPolicy } from "../lib/web-links";
import { colors, fontFamilies, fontSize, space } from "../theme/app2";
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
 *
 * The onboarding gate is a whole screen, so it takes the email door's App 2
 * layout: the 3D Homa over a centered heading and the disclosure, the agree
 * control directly beneath (founder ask 2026-11-03: centered, more
 * professional). Chat and Progress keep the in-place card.
 */
const DISCLOSURE =
  "What you and your kids share here, including what you write and your family's details, is processed by outside AI providers so Homa can help. We never sell it.";

export function AiConsentGate({
  children,
  purpose = "chat",
  embedded = false,
}: {
  children: ReactNode;
  purpose?: "chat" | "progress" | "onboarding";
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
    return <ConsentFrame onboarding={purpose === "onboarding"} embedded={embedded}>
      <LoadingStatus label="Checking your privacy choice" style={{ marginTop: space.xl }} />
    </ConsentFrame>;
  }

  if (status === "given") {
    return <>{children}</>;
  }

  if (status === "failed") {
    return (
      <ConsentFrame onboarding={purpose === "onboarding"} embedded={embedded}>
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
      </ConsentFrame>
    );
  }

  const agreeLabel = saving
    ? "One moment\u2026"
    : purpose === "onboarding"
      ? "I agree, keep going"
      : purpose === "progress"
      ? "I agree, show suggestions"
      : "I agree, let's chat";

  if (purpose === "onboarding") {
    return (
      <ConsentFrame onboarding embedded={embedded}>
        <View style={{ alignItems: "center", gap: space.sm }}>
          <HomaCharacter3D size={96} />
          <Text
            accessibilityRole="header"
            style={{
              textAlign: "center",
              marginTop: space.xs,
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.xxl,
              color: colors.textStrong,
            }}
          >
            Before Homa makes your first page
          </Text>
          <Text
            style={{
              textAlign: "center",
              maxWidth: 340,
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              lineHeight: 22,
              color: colors.textBody,
            }}
          >
            {DISCLOSURE}
          </Text>
        </View>
        <View style={{ gap: space.sm, marginTop: space.xl }}>
          {errorMessage ? <InlineError message={errorMessage} /> : null}
          <App2Button
            label={agreeLabel}
            size="lg"
            onPress={() => void handleAgree()}
            disabled={saving}
            busy={saving}
          />
          <App2Button
            label="Read the privacy policy"
            variant="quiet"
            size="sm"
            onPress={() => void openPrivacyPolicy()}
          />
        </View>
      </ConsentFrame>
    );
  }

  return (
    <ConsentFrame onboarding={false} embedded={embedded}>
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
          {DISCLOSURE}
        </Text>
        <Button
          label="Read the privacy policy"
          variant="ghost"
          onPress={() => void openPrivacyPolicy()}
        />
        {errorMessage ? <InlineError message={errorMessage} /> : null}
        <Button
          label={agreeLabel}
          onPress={() => void handleAgree()}
          disabled={saving}
        />
      </Card>
    </ConsentFrame>
  );
}

function ConsentFrame({ children, onboarding, embedded }: {
  children: ReactNode;
  onboarding: boolean;
  embedded: boolean;
}) {
  if (onboarding) {
    // Spacers sit the content a little above center, where the eye lands.
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.lg, paddingVertical: space.lg }}>
        <View style={{ flexGrow: 1, minHeight: space.lg }} />
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
          {children}
        </View>
        <View style={{ flexGrow: 1.3, minHeight: space.lg }} />
      </ScrollView>
    </SafeAreaView>;
  }
  return <View style={embedded ? undefined : { padding: space.lg }}>{children}</View>;
}
