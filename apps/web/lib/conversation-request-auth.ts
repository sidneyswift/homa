import { createClient } from "@supabase/supabase-js";

import { requestAuthTransport } from "./api-auth";
import type { RecordingPrincipal } from "./conversation-recording";

/** Automatic delivery must use the exact login captured for that attempt.
 * Cookies can change under an in-flight outbox, so this surface is bearer-only. */
export async function resolveConversationRequestPrincipal(request: Request): Promise<RecordingPrincipal | null> {
  const transport = requestAuthTransport(request);
  if (transport.kind !== "bearer") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Conversation authentication unavailable");
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${transport.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(transport.token);
  if (error) {
    // A provider outage is retryable, not evidence that queued text is invalid.
    if (!error.status || error.status >= 500 || error.status === 429) throw error;
    return null;
  }
  if (!data.user) return null;
  const { data: membership, error: membershipError } = await client.from("family_members")
    .select("family_id, families!inner(status)")
    .eq("user_id", data.user.id)
    .neq("families.status", "deleted")
    .order("created_at", { ascending: false })
    .order("family_id", { ascending: true })
    .limit(1).maybeSingle();
  if (membershipError) throw membershipError;
  return membership ? { familyId: membership.family_id, memberUserId: data.user.id } : null;
}
