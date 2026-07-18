import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { mapDb } from "./map/db";

/**
 * Database access for agent tools, always as the CALLER, never as a service
 * role (none exists in this app on purpose; see build-log #3). The caller's
 * Supabase access token comes from the session auth attributes stamped in
 * agent/channels/eve.ts, so every query a tool makes is scoped by RLS to the
 * caller's own family. A model-supplied family id cannot widen access:
 * the database itself is the tenancy wall (BUILD.md law #1).
 */

export interface CallerAuthAttributes {
  familyId?: string;
  supabaseAccessToken?: string;
  memberUserId?: string;
}

export class MissingFamilyContextError extends Error {
  constructor() {
    super(
      "No family context on this session. Ask the parent to finish setup at /app first.",
    );
    this.name = "MissingFamilyContextError";
  }
}

export function createCallerDbClient(attributes: unknown): {
  db: SupabaseClient;
  familyId: string;
} {
  const attrs = (attributes ?? {}) as CallerAuthAttributes;
  const token = attrs.supabaseAccessToken;
  const familyId = attrs.familyId;
  if (!token || !familyId) {
    throw new MissingFamilyContextError();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db, familyId };
}

/**
 * The browser token is a snapshot: the auth walk re-verifies it on every
 * inbound request, but a long agent turn can outlive it (Supabase access
 * tokens live about an hour; a midnight curriculum build runs minutes,
 * and the browser cannot push a refreshed token into a turn already
 * running). Postgres then refuses every RLS query with "JWT expired",
 * which surfaced as find_materials failures in production (the Llanes
 * session, 2026-07-17 02:28 UTC). The margin treats a token about to
 * expire as expired, so a query does not race the boundary mid-flight.
 */
const TOKEN_EXPIRY_GRACE_SECONDS = 15;

/**
 * The token's `exp` claim in epoch seconds, or null when the payload
 * cannot be decoded. No signature check on purpose: this only chooses
 * between two already-authenticated access paths, and the caller path
 * still ends at Supabase's own verification.
 */
export function decodeTokenExpirySeconds(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof decoded.exp === "number" && Number.isFinite(decoded.exp)
      ? decoded.exp
      : null;
  } catch {
    return null;
  }
}

/**
 * True when the token is past (or within the grace margin of) its
 * expiry. An undecodable token reports false: it takes today's caller
 * path and fails at Supabase exactly as it always would, instead of
 * being silently promoted to the pinned fallback.
 */
export function callerTokenIsExpired(token: string, nowSeconds: number): boolean {
  const expiry = decodeTokenExpirySeconds(token);
  if (expiry === null) return false;
  return expiry <= nowSeconds + TOKEN_EXPIRY_GRACE_SECONDS;
}

/**
 * How a tool may touch the database for this session (SMS journal loop,
 * founder direction 2026-07-09 evening):
 *
 *   caller  · web chat. The caller's own JWT; RLS is the tenancy wall
 *             inside the query itself.
 *   pinned  · SMS, inbound email, and dispatcher sessions. No JWT
 *             exists, but the channel stamped familyId from an
 *             application-authenticated mapping (the parent-written
 *             phone row, the family's own registered email address, or
 *             the dispatcher's schedule row), the SAME trust basis the
 *             voice webhook tools already write on. Tools then run
 *             server-side reads/writes pre-scoped to that familyId
 *             through the guarded libs (never raw model input).
 *
 *   A web session whose turn outlived its browser token also degrades
 *   to pinned, but only after a live server-side re-check that the
 *   authenticated member still belongs to the family, so an expired
 *   token never grants MORE than a valid one: RLS re-checks membership
 *   per query on the caller path, and the fallback re-checks it here.
 *
 * Interim until M1-02's SET LOCAL role gives these sessions a real
 * database principal; the seam to swap is exactly this function.
 */
export type AgentAccess =
  | { mode: "caller"; db: SupabaseClient; familyId: string }
  | { mode: "pinned"; familyId: string };

const PINNED_CHANNELS = new Set(["sms", "email", "dispatch"]);

export interface ResolveAgentAccessDependencies {
  /** Does this authenticated user still belong to this family, right now? */
  verifyFamilyMembership(familyId: string, memberUserId: string): Promise<boolean>;
  nowSeconds(): number;
}

async function verifyFamilyMembershipPinned(
  familyId: string,
  memberUserId: string,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ ok: number }[]>`
    select 1 as ok from public.family_members
    where family_id = ${familyId} and user_id = ${memberUserId}
    limit 1
  `;
  return rows.length > 0;
}

const DEFAULT_RESOLVE_DEPENDENCIES: ResolveAgentAccessDependencies = {
  verifyFamilyMembership: verifyFamilyMembershipPinned,
  nowSeconds: () => Math.floor(Date.now() / 1000),
};

export async function resolveAgentAccess(
  attributes: unknown,
  dependencies: ResolveAgentAccessDependencies = DEFAULT_RESOLVE_DEPENDENCIES,
): Promise<AgentAccess> {
  const attrs = (attributes ?? {}) as CallerAuthAttributes & { channel?: string };
  if (attrs.supabaseAccessToken && attrs.familyId) {
    if (!callerTokenIsExpired(attrs.supabaseAccessToken, dependencies.nowSeconds())) {
      const { db, familyId } = createCallerDbClient(attributes);
      return { mode: "caller", db, familyId };
    }
    // The turn outlived the browser token. Degrade to the pinned path
    // on the family stamped at authentication, gated on a live
    // membership re-check (never the stale token, never model input).
    if (
      attrs.memberUserId &&
      (await dependencies.verifyFamilyMembership(attrs.familyId, attrs.memberUserId))
    ) {
      console.warn(
        `agent access: caller token expired mid-session; continuing family-pinned (family ${attrs.familyId})`,
      );
      return { mode: "pinned", familyId: attrs.familyId };
    }
    throw new MissingFamilyContextError();
  }
  if (attrs.channel && PINNED_CHANNELS.has(attrs.channel) && attrs.familyId) {
    return { mode: "pinned", familyId: attrs.familyId };
  }
  throw new MissingFamilyContextError();
}
