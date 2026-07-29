/**
 * EXPO_PUBLIC_ values are inlined into the bundle at build time and are
 * safe to be public (same stance as the web app's NEXT_PUBLIC_ vars):
 * RLS and server-side auth are the security boundary, never the client.
 */

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy apps/mobile/.env.example to apps/mobile/.env and fill it in, then restart the dev server.`,
    );
  }
  return value;
}

/**
 * Sent on every eve request so the shared web/mobile channel handler
 * (apps/web/agent/channels/eve.ts) can tell the two callers apart. Web's
 * own chat client never sends this, so its behavior is untouched by
 * anything gated on this header; mobile is the only caller that needs
 * to be distinguishable, for the mobile-only onboarding gate exemption
 * (gh#305, "phone app only" founder ruling 2026-07-28).
 */
export const EVE_CHANNEL_HEADER = { "X-Homa-Channel": "mobile" } as const;

export const env = {
  get supabaseUrl(): string {
    return requireEnv(
      "EXPO_PUBLIC_SUPABASE_URL",
      process.env.EXPO_PUBLIC_SUPABASE_URL,
    );
  },
  get supabasePublishableKey(): string {
    return requireEnv(
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  },
  /** Origin of the Next.js deployment that hosts the eve routes. */
  get apiUrl(): string {
    return requireEnv("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL);
  },
  /** Optional. Unset until a founder creates the Sentry project. */
  get sentryDsn(): string | undefined {
    return process.env.EXPO_PUBLIC_SENTRY_DSN || undefined;
  },
} as const;
