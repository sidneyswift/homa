import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";

import { supabase } from "../../lib/supabase";
import type { SignInFlowResult } from "./sign-in-result";

/**
 * Native Sign in with Apple: the system account sheet, then the identity
 * token goes straight to Supabase (`signInWithIdToken`), no browser hop.
 * Exists because App Review guideline 4.8 requires an equivalent
 * privacy-preserving option next to Google sign-in, and because it is
 * the nicest flow on the platform anyway.
 *
 * Config this depends on: `usesAppleSignIn` plus the plugin in app.json
 * (the entitlement), and the app's bundle ID registered under the Apple
 * provider's Client IDs in the Supabase dashboard. This is the
 * documented Supabase Expo pattern: no manual nonce, Supabase validates
 * the token's audience against those Client IDs.
 */
export async function signInWithApple(): Promise<SignInFlowResult> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      return { status: "dismissed" };
    }
    // Anything else out of the sheet is Apple's refusal, and Apple has
    // already put its own dialog in front of the parent naming the cause
    // and offering Settings. A parent with no Apple Account signed in
    // lands here with ERR_REQUEST_UNKNOWN, which is not a cancel: before
    // this split Homa answered that correct dialog with "try again when
    // you're ready", advice that could never work.
    return {
      status: "provider-declined",
      reason: error instanceof Error ? error.message : "apple sheet failed",
    };
  }

  if (!credential.identityToken) {
    return { status: "failed", reason: "no identity token" };
  }

  // Apple supplies the name once. Keep an account-keyed retry copy until
  // Supabase confirms it, including when the identity exchange fails.
  const nameKey = `homa.apple-profile:${credential.user}`;
  const fullName = credential.fullName
    ? AppleAuthentication.formatFullName(credential.fullName).trim()
    : "";
  if (fullName) await AsyncStorage.setItem(nameKey, fullName).catch(() => {});

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
  });
  if (error) return { status: "failed", reason: error.message };

  const pendingName = fullName || await AsyncStorage.getItem(nameKey).catch(() => null);
  if (pendingName) {
    if (data.user?.user_metadata?.full_name) {
      await AsyncStorage.removeItem(nameKey).catch(() => {});
    } else {
      const saved = await supabase.auth.updateUser({ data: { full_name: pendingName } })
        .catch(() => ({ error: true }));
      if (!saved.error) await AsyncStorage.removeItem(nameKey).catch(() => {});
    }
  }

  return { status: "signed-in" };
}
