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
      "No family context on this session. Ask the parent to finish setup at /home first.",
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
