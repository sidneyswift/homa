import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ErrorBoundary } from "../components/error-boundary";
import { SessionProvider, useSession } from "../features/auth/session-provider";
import { initCrashReporting } from "../lib/crash-reporting";
import { installStreamingFetch } from "../lib/streaming-fetch";
import { useHomaFonts } from "../theme/fonts";
import { colors } from "../theme/tokens";

// Must run before any module sends a request: eve streams NDJSON over
// fetch and React Native's built-in fetch cannot read response streams.
installStreamingFetch();

// A clean no-op until a founder creates the Sentry project (src/lib/
// crash-reporting.ts); safe to always call.
initCrashReporting();

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const fontsLoaded = useHomaFonts();
  const { initializing } = useSession();
  const ready = fontsLoaded && !initializing;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.page },
      }}
    >
      {/* The voice-first surface covers the whole app; its own close
          button is the way back (features/voice/voice-screen.tsx). */}
      <Stack.Screen name="voice" options={{ presentation: "fullScreenModal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <RootNavigator />
        <StatusBar style="dark" />
      </SessionProvider>
    </ErrorBoundary>
  );
}
