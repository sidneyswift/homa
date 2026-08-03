import type { MobileBootstrapFailureReason } from "@homa/core";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSession } from "../features/auth/session-provider";
import { AddChildForm } from "../features/family/add-child-form";
import { reportBootstrapEvent } from "../features/bootstrap/bootstrap-events";
import { useFamilyData } from "../features/family/use-family-data";
import type { FamilyRecord } from "../lib/family";
import { completeMyFamilySetup } from "../lib/family";
import { reportCrash } from "../lib/crash-reporting";
import {
  openPrivacyPolicy,
  openTermsOfUse,
  openWebOnboarding,
} from "../lib/web-links";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { InlineError } from "./ui/inline-error";
import { LoadingStatus } from "./ui/loading-status";
import { FamilySetupForm } from "./family-setup-form";

export function FamilyReadinessGate({
  children,
}: {
  children: (family: FamilyRecord) => ReactNode;
}) {
  const {
    family,
    children: familyChildren,
    loading,
    error,
    failureReason,
    reload,
  } = useFamilyData();
  const { continueSignedOut } = useSession();
  const reportedFailure = useRef<MobileBootstrapFailureReason | null>(null);
  const loadingAttemptReported = useRef(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  async function continueOnWeb() {
    setHandoffError(null);
    try {
      await openWebOnboarding();
    } catch (cause) {
      reportCrash(cause, {
        surface: "native-onboarding",
        operation: "open-web-onboarding",
      });
      setHandoffError("We could not open onboarding. Try again in a moment.");
    }
  }
  const currentFailure =
    failureReason ?? (!loading && !error && !family ? "not_ready" : null);

  useEffect(() => {
    if (loading && !loadingAttemptReported.current) {
      loadingAttemptReported.current = true;
      void reportBootstrapEvent("attempted", "family");
    } else if (!loading) {
      loadingAttemptReported.current = false;
    }
  }, [loading]);

  useEffect(() => {
    if (!currentFailure || reportedFailure.current === currentFailure) return;
    reportedFailure.current = currentFailure;
    void reportBootstrapEvent("failed", "family", currentFailure);
  }, [currentFailure]);

  useEffect(() => {
    const recoveredFrom = reportedFailure.current;
    if (!family || !recoveredFrom) return;
    reportedFailure.current = null;
    void reportBootstrapEvent("recovered", "family", recoveredFrom);
  }, [family]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (
        state === "active"
        && (!family || familyChildren.length === 0 || !family.profile_completed_at)
      ) {
        void reload();
      }
    });
    return () => subscription.remove();
  }, [family, familyChildren.length, reload]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <LoadingStatus label="Loading your family" />
      </View>
    );
  }

  if (error) {
    const expiredSession = failureReason === "expired_session";
    return (
      <FamilyReadinessState
        title={expiredSession ? "Your sign-in needs a refresh" : "Your family is safe"}
        body={
          expiredSession
            ? "Your sign-in expired before Homa could check your family. Sign in again and your family data will still be here."
            : "We could not check your family setup. Check your connection and try again."
        }
        primaryLabel="Try again"
        onPrimary={() => void reload()}
        onSwitchAccount={continueSignedOut}
        switchAccountLabel={expiredSession ? "Continue to sign in" : undefined}
      />
    );
  }

  if (!family) {
    return (
      <FamilyReadinessState
        title="Let's start here"
        body="A few details make Homa useful right away. You can finish your family setup here, without leaving the app."
        onSwitchAccount={continueSignedOut}
      >
        <FamilySetupForm embedded onCreated={reload} />
        {handoffError ? <InlineError message={handoffError} /> : null}
        <Button
          label="Continue setup on the web"
          variant="secondary"
          onPress={() => void continueOnWeb()}
        />
        <Button
          label="Check again"
          variant="ghost"
          onPress={() => void reload()}
        />
      </FamilyReadinessState>
    );
  }

  if (familyChildren.length === 0) {
    return (
      <FamilyReadinessState
        title="Let's meet your learner"
        body="Add one child and Homa can start helping with a real day. You can add another child later."
        onSwitchAccount={continueSignedOut}
      >
        <AddChildForm
          embedded
          familyId={family.id}
          onAdded={() => reload()}
        />
        {handoffError ? <InlineError message={handoffError} /> : null}
        <Button
          label="Continue setup on the web"
          variant="secondary"
          onPress={() => void continueOnWeb()}
        />
      </FamilyReadinessState>
    );
  }

  if (!family.profile_completed_at) {
    return (
      <FamilyReadinessState
        title="One last step"
        body="Homa has your learner. Finish this small handoff and the rest of the app will be ready for your family."
        primaryLabel="Finish setup"
        primaryBusy={completionPending}
        onPrimary={() => {
          if (completionPending) return;
          setCompletionPending(true);
          setCompletionError(null);
          void completeMyFamilySetup()
            .then(() => reload())
            .catch((cause) => {
              reportCrash(cause, {
                surface: "native-onboarding",
                operation: "complete-family-setup",
              });
              setCompletionError(
                "Homa could not confirm that handoff yet. Nothing else changed. Try again when you are ready.",
              );
              void reload().catch((reconcileCause) => {
                reportCrash(reconcileCause, {
                  surface: "native-onboarding",
                  operation: "reconcile-family-completion",
                });
              });
            })
            .finally(() => setCompletionPending(false));
        }}
        onSwitchAccount={continueSignedOut}
      >
        {completionError ? <InlineError message={completionError} /> : null}
      </FamilyReadinessState>
    );
  }

  return <>{children(family)}</>;
}

function FamilyReadinessState({
  title,
  body,
  primaryLabel,
  onPrimary,
  primaryBusy = false,
  secondaryLabel,
  onSecondary,
  onSwitchAccount,
  switchAccountLabel = "Use a different account",
  children,
}: {
  title: string;
  body: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryBusy?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onSwitchAccount: () => void;
  switchAccountLabel?: string;
  children?: ReactNode;
}) {
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
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ gap: space.md }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fontFamilies.display,
                fontSize: fontSize.xxl,
                color: colors.textStrong,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              {body}
            </Text>
            {children}
            {primaryLabel && onPrimary ? (
              <Button
                label={primaryBusy ? "Finishing setup…" : primaryLabel}
                onPress={onPrimary}
                busy={primaryBusy}
              />
            ) : null}
            {secondaryLabel && onSecondary ? (
              <Button
                label={secondaryLabel}
                variant="secondary"
                onPress={onSecondary}
              />
            ) : null}
            <Button
              label={switchAccountLabel}
              variant="ghost"
              onPress={onSwitchAccount}
            />
            <View style={{ gap: space.xs }}>
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.xs,
                  color: colors.textMuted,
                  textAlign: "center",
                }}
              >
                {"Review Homa's privacy and terms whenever you need them."}
              </Text>
              <Button
                label="Privacy policy"
                size="sm"
                variant="ghost"
                onPress={() => void openPrivacyPolicy()}
              />
              <Button
                label="Terms of use"
                size="sm"
                variant="ghost"
                onPress={() => void openTermsOfUse()}
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
