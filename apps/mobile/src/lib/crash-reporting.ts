import * as Sentry from "@sentry/react-native";

import { env } from "./env";

/**
 * Clean no-op until EXPO_PUBLIC_SENTRY_DSN is set (it is unset everywhere
 * today; a founder creating the Sentry project is the only step left).
 * Call once at module init, same place installStreamingFetch runs.
 *
 * This captures JS exceptions as soon as a DSN exists; native module
 * autolinking needs no extra setup. Native crash symbolication and
 * automatic source-map upload need one more step once a DSN exists: add
 * the `@sentry/react-native/expo` config plugin to app.json and set
 * SENTRY_AUTH_TOKEN/ORG/PROJECT as EAS secrets, then rebuild. Deliberately
 * not done yet: an unconfigured native build plugin is a way to fail a
 * store build for no reason before real Sentry credentials exist.
 */
export function initCrashReporting() {
  if (!env.sentryDsn) return;

  Sentry.init({
    dsn: env.sentryDsn,
    // Errors only for v1; performance/session-replay tracing is a later
    // tuning pass once real crash volume exists to compare against.
    tracesSampleRate: 0,
  });
}

export function reportCrash(error: unknown, extra?: Record<string, unknown>) {
  if (!env.sentryDsn) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}
