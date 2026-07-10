import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
 * Interim until M1-02's SET LOCAL role gives these sessions a real
 * database principal; the seam to swap is exactly this function.
 */
export type AgentAccess =
  | { mode: "caller"; db: SupabaseClient; familyId: string }
  | { mode: "pinned"; familyId: string };

const PINNED_CHANNELS = new Set(["sms", "email", "dispatch"]);

export function resolveAgentAccess(attributes: unknown): AgentAccess {
  const attrs = (attributes ?? {}) as CallerAuthAttributes & { channel?: string };
  if (attrs.supabaseAccessToken && attrs.familyId) {
    const { db, familyId } = createCallerDbClient(attributes);
    return { mode: "caller", db, familyId };
  }
  if (attrs.channel && PINNED_CHANNELS.has(attrs.channel) && attrs.familyId) {
    return { mode: "pinned", familyId: attrs.familyId };
  }
  throw new MissingFamilyContextError();
}
