import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { env } from "./env";

/**
 * Expo Router's dev server evaluates every route's module graph, this
 * one included, under a plain Node server-render pass to build its
 * route manifest (react-native-async-storage internally reaches for
 * `window`, and `AppState` for a native bridge, neither of which exist
 * there), crashing the whole Metro process on cold start (caught
 * 2026-09-01: `ReferenceError: window is not defined` deep inside
 * SupabaseAuthClient, with no code of ours in the trace). The canonical
 * React Native environment check, real native and the Expo web target
 * both set `navigator.product`, Metro's Node SSR pass does not.
 */
const isReactNative =
  typeof navigator !== "undefined" && navigator.product === "ReactNative";

/** No-ops outside a real RN/web runtime instead of touching a bridge
 * that was never installed there. */
const sessionStorage = isReactNative
  ? AsyncStorage
  : {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    };

/**
 * The mobile Supabase client: same project and publishable key as
 * apps/web, but sessions persist in AsyncStorage instead of cookies
 * (the documented Supabase React Native pattern). RLS remains the
 * security boundary; this key is designed to be public.
 */
export const supabase = createClient(
  env.supabaseUrl,
  env.supabasePublishableKey,
  {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // supabase-js defaults to the implicit flow, which returns tokens in
      // a URL fragment a deep link cannot hand back reliably. PKCE returns
      // a code we exchange ourselves, and it stores the verifier in the
      // AsyncStorage above so the exchange survives the browser hop. The
      // web app gets this for free from @supabase/ssr; mobile must ask.
      flowType: "pkce",
    },
  },
);

// Refresh tokens only while the app is foregrounded (Supabase's
// recommended React Native setup; backgrounded timers are unreliable).
// Guarded the same way: AppState has no bridge to attach to outside a
// real RN/web runtime either.
if (isReactNative) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
