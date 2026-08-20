import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "../../lib/supabase";
import type { SignInFlowResult } from "./sign-in-result";

/**
 * Browser-based Google sign-in, the mobile twin of the web flow in
 * apps/web/app/signin/signin-form.tsx plus apps/web/app/auth/callback.
 *
 * The shape is the same three steps the web app takes, just split across
 * a browser hop the phone has to drive itself:
 *
 *   1. Ask Supabase for Google's authorize URL. `skipBrowserRedirect`
 *      keeps supabase-js from trying to navigate; React Native has no
 *      window.location to navigate.
 *   2. Open it in the system auth browser. Not a WebView: Google refuses
 *      OAuth in embedded webviews, and openAuthSessionAsync gets us
 *      ASWebAuthenticationSession on iOS and Custom Tabs on Android.
 *   3. Exchange the returned code for a session. SessionProvider's
 *      onAuthStateChange then swaps the sign-in screen for the tabs, so
 *      nothing here needs to navigate.
 *
 * The redirect target must be on Supabase's allow list (dashboard →
 * Authentication → URL Configuration), same requirement the web callback
 * route documents.
 */

/**
 * The literal deep link, deliberately not Linking.createURL: under a dev
 * client createURL bakes the Metro host in (homa://192.168.x.x:8081/...),
 * which fails Supabase's exact-match allowlist and strands the browser
 * sheet on the Site URL. The iOS auth session captures the return by
 * scheme alone, so this exact form behaves the same in dev-client and
 * store builds, and the allowlist stays one entry: homa://auth/callback.
 * The path matches the web callback route so the two flows read alike.
 */
const REDIRECT_URL = "homa://auth/callback";

export async function signInWithGoogle(): Promise<SignInFlowResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
  });
  if (error) return { status: "failed", reason: error.message };
  if (!data?.url) return { status: "failed", reason: "no authorize url" };

  const outcome = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);
  if (outcome.type !== "success") return { status: "dismissed" };

  // Linking.parse, not `new URL`: React Native's URL has no searchParams.
  const { queryParams } = Linking.parse(outcome.url);
  const code = typeof queryParams?.code === "string" ? queryParams.code : null;
  if (!code) {
    // Google naming its own refusal in the callback means the parent
    // already read it on Google's page, so Homa stays quiet. A callback
    // carrying neither a code nor a reason explained nothing to anyone,
    // so that one speaks.
    const declined =
      typeof queryParams?.error_description === "string"
        ? queryParams.error_description
        : typeof queryParams?.error === "string"
          ? queryParams.error
          : null;
    if (declined) return { status: "provider-declined", reason: declined };
    return { status: "failed", reason: "callback carried no code" };
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return { status: "failed", reason: exchangeError.message };

  return { status: "signed-in" };
}
