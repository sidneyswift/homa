import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import type {
  MobileBootstrapFailureReason,
  MobileBootstrapStage,
} from "@homa/core";

import { ErrorBoundary } from "../components/error-boundary";
import { SessionProvider, useSession } from "../features/auth/session-provider";
import { VoiceWorkbenchProvider } from "../features/voice/voice-workbench-provider";
import { initCrashReporting } from "../lib/crash-reporting";
import { installStreamingFetch } from "../lib/streaming-fetch";
import { BOOTSTRAP_TIMEOUT_MS } from "../features/bootstrap/bootstrap";
import { reportBootstrapEvent } from "../features/bootstrap/bootstrap-events";
import { useHomaFonts } from "../theme/fonts";
import { colors, fontSize, radius, space } from "../theme/tokens";

// Must run before any module sends a request: eve streams NDJSON over
// fetch and React Native's built-in fetch cannot read response streams.
installStreamingFetch();

// A clean no-op until a founder creates the Sentry project (src/lib/
// crash-reporting.ts); safe to always call.
initCrashReporting();

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const fonts = useHomaFonts();
  const { initializing, failureReason: sessionFailure, retry, continueSignedOut } =
    useSession();
  const [fontFailure, setFontFailure] =
    useState<MobileBootstrapFailureReason | null>(null);
  const [fontsBypassed, setFontsBypassed] = useState(false);
  const [splashReleased, setSplashReleased] = useState(false);
  const reportedFontFailure = useRef<MobileBootstrapFailureReason | null>(null);
  const currentFontFailure =
    !fonts.loaded && !fontsBypassed
      ? fonts.error
        ? "unknown"
        : fontFailure
      : null;
  const ready =
    (fonts.loaded || fontsBypassed) && !initializing && !sessionFailure;

  useEffect(() => {
    void reportBootstrapEvent("attempted", "fonts");
  }, []);

  useEffect(() => {
    if (fonts.loaded || fonts.error || fontsBypassed) return;
    const timer = setTimeout(() => setFontFailure("timeout"), BOOTSTRAP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fonts.loaded, fonts.error, fontsBypassed]);

  useEffect(() => {
    if (
      !currentFontFailure ||
      reportedFontFailure.current === currentFontFailure
    ) {
      return;
    }
    reportedFontFailure.current = currentFontFailure;
    void reportBootstrapEvent("failed", "fonts", currentFontFailure);
  }, [currentFontFailure]);

  useEffect(() => {
    const recoveredFrom = reportedFontFailure.current;
    if (!fonts.loaded || !recoveredFrom) return;
    void reportBootstrapEvent("recovered", "fonts", recoveredFrom);
    reportedFontFailure.current = null;
  }, [fonts.loaded]);

  useEffect(() => {
    if (ready || currentFontFailure || sessionFailure) {
      void SplashScreen.hideAsync().finally(() => setSplashReleased(true));
    }
  }, [ready, currentFontFailure, sessionFailure]);

  function continueWithoutFonts() {
    const recoveredFrom = currentFontFailure ?? "unknown";
    setFontsBypassed(true);
    setFontFailure(null);
    reportedFontFailure.current = null;
    void reportBootstrapEvent("recovered", "fonts", recoveredFrom);
  }

  if (currentFontFailure) {
    return (
      <RootBootstrapFailure
        stage="fonts"
        reason={currentFontFailure}
        onRetry={continueWithoutFonts}
      />
    );
  }

  if (sessionFailure) {
    return (
      <RootBootstrapFailure
        stage="session"
        reason={sessionFailure}
        onRetry={retry}
        onContinueSignedOut={continueSignedOut}
      />
    );
  }

  if (!ready) {
    return splashReleased ? <RootLoadingState /> : null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.page },
      }}
    />
  );
}

function RootLoadingState() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.page,
        gap: space.md,
      }}
    >
      <ActivityIndicator color={colors.brand} />
      <Text style={{ fontSize: fontSize.base, color: colors.textBody }}>
        Opening Homa...
      </Text>
    </View>
  );
}

function RootBootstrapFailure({
  stage,
  reason,
  onRetry,
  onContinueSignedOut,
}: {
  stage: Extract<MobileBootstrapStage, "fonts" | "session">;
  reason: MobileBootstrapFailureReason;
  onRetry: () => void;
  onContinueSignedOut?: () => void;
}) {
  const fontFailure = stage === "fonts";
  const expiredSession = stage === "session" && reason === "expired_session";
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        backgroundColor: colors.page,
        padding: space.lg,
        gap: space.md,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ fontSize: fontSize.xxl, fontWeight: "700", color: colors.textStrong }}
      >
        {fontFailure ? "Homa can still open" : "Homa needs another try"}
      </Text>
      <Text style={{ fontSize: fontSize.base, color: colors.textBody }}>
        {fontFailure
          ? "The app's text did not finish loading. You can continue with standard text."
          : expiredSession
            ? "Your sign-in has expired. Your family data is safe."
            : "We could not open your account. Nothing was changed."}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={{
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.pill,
          backgroundColor: colors.brand,
          paddingHorizontal: space.lg,
        }}
      >
        <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.onBrand }}>
          {fontFailure ? "Use standard text" : "Try again"}
        </Text>
      </Pressable>
      {onContinueSignedOut ? (
        <Pressable
          accessibilityRole="button"
          onPress={onContinueSignedOut}
          style={{
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: space.lg,
          }}
        >
          <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.textStrong }}>
            Continue to sign in
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <VoiceWorkbenchProvider>
          <RootNavigator />
        </VoiceWorkbenchProvider>
        <StatusBar style="dark" />
      </SessionProvider>
    </ErrorBoundary>
  );
}
