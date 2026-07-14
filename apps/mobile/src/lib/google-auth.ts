import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "./supabase";

/**
 * Google OAuth flow for React Native, following the Supabase + Expo pattern:
 *
 *   1. Ask Supabase for the OAuth URL (skipBrowserRedirect so WE control the browser)
 *   2. Open that URL in an in-app auth session (expo-web-browser)
 *   3. Parse the returned deep-link for access_token + refresh_token
 *   4. Hand those tokens to supabase.auth.setSession()
 *
 * The SessionProvider's onAuthStateChange listener picks up the new session
 * automatically after setSession succeeds.
 *
 * SUPABASE DASHBOARD REQUIREMENT:
 *   Authentication → URL Configuration → add the redirect URL logged below
 *   (e.g. `homa://google-auth` or `exp://...` in dev) to the Redirect URLs
 *   allowlist. Both the dev and production values need to be listed.
 */

const REDIRECT_URI = Linking.createURL("google-auth");

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  try {
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: REDIRECT_URI,
        skipBrowserRedirect: true,
      },
    });

    if (oauthError || !data.url) {
      return { error: oauthError?.message ?? "Could not start Google sign-in." };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

    if (result.type !== "success" || !result.url) {
      // User cancelled or the browser session was dismissed.
      return { error: null };
    }

    // Parse fragment: #access_token=...&refresh_token=...
    const fragment = result.url.split("#")[1];
    if (!fragment) {
      return { error: "Google sign-in completed but no session was returned." };
    }

    const params = new URLSearchParams(fragment);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      return { error: "Google sign-in completed but tokens were missing." };
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      return { error: sessionError.message };
    }

    return { error: null };
  } catch (err) {
    console.error("Google sign-in error:", err);
    return { error: "Something went wrong with Google sign-in. Please try again." };
  }
}
