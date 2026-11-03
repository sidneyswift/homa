/**
 * Environments for running the web app and Metro against the local stack
 * (tooling/local-stack/README.md). Pure functions, so the isolation rules
 * are testable without Docker (scripts/local-stack-env.test.mts).
 *
 * The web rule is an allowlist, not a denylist. apps/web/.env.local holds
 * production credentials, and Next.js loads it on every `next dev`. A key
 * that is already present in process.env, even as an empty string, wins
 * over the file (@next/env only fills keys that are undefined). So every
 * key the env files define is passed as "" unless it is explicitly safe:
 * the model gateway, read-only provider APIs, feature flags and public
 * Stripe test links. A credential added to .env.local tomorrow is blanked
 * by default, which a denylist cannot promise.
 */

import { DURABLE_WRITE_ENV_VARS } from "../apps/web/lib/eval-isolation";

import { isLocalBackendUrl } from "../apps/mobile/src/lib/local-backend";

export interface LocalStackEndpoints {
  /** Supabase API gateway, e.g. http://127.0.0.1:54321 */
  apiUrl: string;
  /** The publishable (anon) key the local stack prints. */
  publishableKey: string;
  /** Superuser Postgres URL, e.g. postgresql://postgres:postgres@127.0.0.1:54322/postgres */
  dbUrl: string;
  /** Local artifact store directory and the loopback URL that serves it. */
  blobDir: string;
  blobUrl: string;
}

/** Keys the web app may keep from its env files when running locally. */
const SAFE_EXACT = new Set([
  // Model gateway (founder ruling 2026-07-27: OIDC only, never a key).
  "VERCEL_OIDC_TOKEN",
  // Provider APIs that read or generate, and write nothing of Homa's.
  "OPENAI_API_KEY",
  "ELEVENLABS_API_KEY",
  "TWELVELABS_API_KEY",
  "LEARNINGCOMMONS_API_KEY",
  "SERPAPI_API_KEY",
  "FIRECRAWL_API_KEY",
  // Flags.
  "REPORT_NARRATIVE_ENABLED",
  "HOMA_DEV_TEST_SESSIONS",
]);

/** Flags that send real mail, SMS or cards stay off locally. */
const UNSAFE_FLAGS = new Set([
  "TELNYX_SMS_ENABLED",
  "THANK_YOU_CARDS_ENABLED",
]);

export function isSafeLocalWebKey(key: string): boolean {
  if ((DURABLE_WRITE_ENV_VARS as readonly string[]).includes(key)) return false;
  if (UNSAFE_FLAGS.has(key)) return false;
  if (SAFE_EXACT.has(key)) return true;
  if (/^HOMA_[A-Z0-9_]+_ENABLED$/u.test(key)) return true;
  // Public Stripe test-mode payment links; live links and every secret
  // key fall through to blank.
  if (/^NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_[A-Z_]+_URL$/u.test(key)) return true;
  return false;
}

function requireLocal(endpoints: LocalStackEndpoints): void {
  for (const [name, url] of [
    ["Supabase API", endpoints.apiUrl],
    ["database", endpoints.dbUrl],
    ["artifact store", endpoints.blobUrl],
  ] as const) {
    if (!isLocalBackendUrl(url)) {
      throw new Error(
        `local stack: the ${name} URL is not on this machine (${url}); refusing to point a dev server at it`,
      );
    }
  }
}

/**
 * The process environment for `next dev` against the local stack.
 * envFileKeys: every key defined in apps/web's .env* files.
 */
export function localWebEnvironment(
  envFileKeys: Iterable<string>,
  endpoints: LocalStackEndpoints,
): Record<string, string> {
  requireLocal(endpoints);
  const environment: Record<string, string> = {};
  for (const key of envFileKeys) {
    if (!isSafeLocalWebKey(key)) environment[key] = "";
  }
  // Credentials that are not in the files today are blanked too, so a
  // value inherited from the shell cannot reach production either.
  for (const key of DURABLE_WRITE_ENV_VARS) environment[key] = "";
  return {
    ...environment,
    NEXT_PUBLIC_SUPABASE_URL: endpoints.apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: endpoints.publishableKey,
    // The eval isolation seam (apps/web/lib/eval-isolation.ts) is the one
    // place server code already honors a local database and artifact
    // store; the local stack reuses it rather than adding a second one.
    HOMA_EVAL_ISOLATION: "1",
    HOMA_EVAL_DATABASE_URL: endpoints.dbUrl,
    HOMA_EVAL_BLOB_DIR: endpoints.blobDir,
    HOMA_EVAL_BLOB_URL: endpoints.blobUrl,
    HOMA_LOCAL_STACK: "1",
  };
}

/** The process environment for Metro (apps/mobile) against the local stack. */
export function localMobileEnvironment(
  endpoints: LocalStackEndpoints,
  webOrigin: string,
): Record<string, string> {
  requireLocal(endpoints);
  if (!isLocalBackendUrl(webOrigin)) {
    throw new Error(`local stack: the web origin is not on this machine (${webOrigin})`);
  }
  return {
    EXPO_PUBLIC_SUPABASE_URL: endpoints.apiUrl,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: endpoints.publishableKey,
    EXPO_PUBLIC_API_URL: webOrigin,
    EXPO_PUBLIC_SENTRY_DSN: "",
  };
}

/** Keys defined in a dotenv file's text, values ignored. */
export function dotenvKeys(text: string): string[] {
  const keys: string[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=/u.exec(line);
    if (match) keys.push(match[1]);
  }
  return keys;
}
