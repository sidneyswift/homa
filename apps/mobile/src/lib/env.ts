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
