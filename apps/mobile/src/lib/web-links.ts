import { Linking } from "react-native";

import { env } from "./env";

function webUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${env.apiUrl.replace(/\/+$/, "")}${normalizedPath}`;
}

export function openWebOnboarding(): Promise<void> {
  return Linking.openURL(webUrl("/onboarding"));
}

export function openPrivacyPolicy(): Promise<void> {
  return Linking.openURL(webUrl("/privacy"));
}

export function openTermsOfUse(): Promise<void> {
  return Linking.openURL(webUrl("/terms"));
}

/** Neutral account/subscription surface, never a checkout page directly. */
export function openWebAccount(): Promise<void> {
  return Linking.openURL(webUrl("/app/settings"));
}

/** Apple owns management for an App Store subscription. This is not a
 * web checkout link, it opens Apple's subscription-management surface. */
export function openAppleSubscriptions(): Promise<void> {
  return Linking.openURL("https://apps.apple.com/account/subscriptions");
}

export function openSupportEmail(): Promise<void> {
  return Linking.openURL("mailto:hello@thankshoma.com");
}
