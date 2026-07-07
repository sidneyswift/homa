import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { env } from "./env";

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
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Refresh tokens only while the app is foregrounded (Supabase's
// recommended React Native setup; backgrounded timers are unreliable).
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
