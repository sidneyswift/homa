import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { SessionProvider, useSession } from "../features/auth/session-provider";
import { installStreamingFetch } from "../lib/streaming-fetch";
import { useHomaFonts } from "../theme/fonts";
import { colors } from "../theme/tokens";

// Must run before any module sends a request: eve streams NDJSON over
// fetch and React Native's built-in fetch cannot read response streams.
installStreamingFetch();

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
    />
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
      <StatusBar style="dark" />
    </SessionProvider>
  );
}
