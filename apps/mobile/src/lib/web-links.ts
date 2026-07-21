import { Linking } from "react-native";

import { env } from "./env";

function webUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${env.apiUrl.replace(/\/+$/, "")}${normalizedPath}`;
}

export function openWebOnboarding(): Promise<void> {
  return Linking.openURL(webUrl("/onboarding"));
}

/** Billing and account management stay on the web; mobile links out. */
export function openWebSettings(): Promise<void> {
  return Linking.openURL(webUrl("/app/settings"));
}
