/**
 * Where the tenancy isolation guard (scripts/isolation-check.mjs) points.
 * A hosted project is reached through its API URL plus the Supabase
 * pooler; the local stack (tooling/local-stack/README.md) passes its own
 * database URL in HOMA_ISOLATION_DATABASE_URL. Both ends must name the
 * same target: a local API checked against a hosted database, or the
 * reverse, would report on one project while writing fixtures into
 * another. Tested in scripts/live-fixture-safety.test.mjs.
 */

/** True when the URL's host is this machine's loopback interface. */
export function isLoopbackUrl(value) {
  let host;
  try {
    host = new URL(value).hostname;
  } catch {
    return false;
  }
  return host === "localhost" || host === "[::1]" || /^127(?:\.\d{1,3}){3}$/u.test(host);
}

/** Why the API URL and the local database URL disagree, or null when they agree. */
export function isolationTargetMismatch(apiUrl, localDatabaseUrl) {
  const apiIsLocal = isLoopbackUrl(apiUrl);
  if (localDatabaseUrl) {
    if (!apiIsLocal) {
      return `HOMA_ISOLATION_DATABASE_URL is set, but the Supabase URL is hosted (${apiUrl})`;
    }
    if (!isLoopbackUrl(localDatabaseUrl)) {
      return "HOMA_ISOLATION_DATABASE_URL is not on this machine";
    }
    return null;
  }
  if (apiIsLocal) {
    return `the Supabase URL is local (${apiUrl}) but no local database was given; run pnpm dev:stack isolation`;
  }
  return null;
}
