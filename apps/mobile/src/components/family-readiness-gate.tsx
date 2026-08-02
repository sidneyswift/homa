import type { MobileBootstrapFailureReason } from "@homa/core";
import { useEffect, useRef, type ReactNode } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSession } from "../features/auth/session-provider";
import { reportBootstrapEvent } from "../features/bootstrap/bootstrap-events";
import { useFamilyData } from "../features/family/use-family-data";
import type { FamilyRecord } from "../lib/family";
import { openWebOnboarding } from "../lib/web-links";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function FamilyReadinessGate({
  children,
}: {
  children: (family: FamilyRecord) => ReactNode;
}) {
  const { family, loading, error, failureReason, reload } = useFamilyData();
  const { continueSignedOut } = useSession();
  const reportedFailure = useRef<MobileBootstrapFailureReason | null>(null);
  const loadingAttemptReported = useRef(false);
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
      if (state === "active" && !family) void reload();
    });
    return () => subscription.remove();
  }, [family, reload]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <FamilyReadinessState
        title="Your family is safe"
        body="We could not check your family setup. Check your connection and try again."
        primaryLabel="Try again"
        onPrimary={() => void reload()}
        onSwitchAccount={continueSignedOut}
      />
    );
  }

  if (!family) {
    return (
      <FamilyReadinessState
        title="Let's finish your setup"
        body="Your account is signed in, but your family setup is not finished yet. Finish it on the web, then come back here."
        primaryLabel="Finish setup"
        onPrimary={() => void openWebOnboarding()}
        secondaryLabel="Check again"
        onSecondary={() => void reload()}
        onSwitchAccount={continueSignedOut}
      />
    );
  }

  return <>{children(family)}</>;
}

function FamilyReadinessState({
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onSwitchAccount,
}: {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onSwitchAccount: () => void;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: space.lg,
        }}
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
          <Button label={primaryLabel} onPress={onPrimary} />
          {secondaryLabel && onSecondary ? (
            <Button
              label={secondaryLabel}
              variant="secondary"
              onPress={onSecondary}
            />
          ) : null}
          <Button
            label="Use a different account"
            variant="ghost"
            onPress={onSwitchAccount}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}
