/**
 * GET /api/dev/oidc-status: is the local gateway credential still alive?
 *
 * A dev-only answer to one question the chat surface cannot otherwise
 * tell apart: did that turn fail because of the product, or because this
 * machine's Vercel OIDC token went stale?
 *
 * The two look identical from the client. The agent reaches the AI
 * Gateway with VERCEL_OIDC_TOKEN, a JWT that lives about twelve hours
 * and is never renewed under a running dev server, so it dies mid
 * session rather than at startup. On 2026-07-22 that produced a
 * chat-first onboarding walk where every turn failed and the screen said
 * "that last message didn't go through", the parent-facing copy, with
 * nothing anywhere naming a local credential. It read as a product bug
 * for a while.
 *
 * scripts/dev-oidc-preflight.mjs stops a dev server starting on a dead
 * token. This is the other half: the token that was alive at startup and
 * is not now.
 *
 * Two gates, same as the rest of /api/dev: never in production, never
 * without HOMA_DEV_TEST_SESSIONS. It returns an expiry timestamp and
 * nothing else, never the token, so even inside those gates there is no
 * credential to leak.
 */

function devTestSessionsEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const value = (process.env.HOMA_DEV_TEST_SESSIONS ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

/** The exp claim in milliseconds, or null if it cannot be read. */
export function oidcExpiresAt(token: string | undefined): number | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const padded = payload.padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      "=",
    );
    const decoded = JSON.parse(
      Buffer.from(padded, "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export async function GET(): Promise<Response> {
  if (!devTestSessionsEnabled()) return new Response("Not found", { status: 404 });

  const expiresAt = oidcExpiresAt(process.env.VERCEL_OIDC_TOKEN);
  return Response.json({
    // present: there is a token at all. expired: we can prove it is past.
    // An unreadable token reports present with a null expiry, because
    // "we could not parse it" must never be shown as "it is expired".
    present: Boolean(process.env.VERCEL_OIDC_TOKEN),
    expiresAt,
    expired: expiresAt !== null && expiresAt <= Date.now(),
  });
}
