import { createSupabaseServerClient } from "./supabase/server";
import {
  mergeChatHistoryRows,
  recentSessionIds,
  type ChatHistoryMessage,
  type ChatHistoryRow,
} from "./chat-history-model";

/**
 * The per-adult server read behind the synced web transcript (M1-02
 * render slice + ruling chat-privacy-per-adult, both 2026-07-12).
 *
 * Runs under the CALLER'S OWN JWT (createSupabaseServerClient), so RLS
 * stays the tenancy wall; the per-adult shape is the query filter until
 * the SELECT policy itself tightens (logged follow-up, expand-contract).
 * Three slices make up "my conversation":
 *
 *   1. my rows            member_user_id = me (web, texts, email replies)
 *   2. companion rows     Homa's replies in my sessions (assistant rows
 *                         carry no member attribution by design)
 *   3. delivered rows     messages Homa addressed to me on any channel
 *                         (briefs, task results) via conversation_deliveries
 *
 * Single-adult families also claim legacy rows written before member
 * attribution existed (they can only belong to the one adult). In
 * multi-adult families those legacy rows stay hidden: the privacy-safe
 * direction under the ruling.
 *
 * Failure posture: any error returns null and the client renders from
 * its localStorage cache exactly as before this slice existed.
 */

const HISTORY_CAP = 240;
const SLICE_LIMIT = 300;
const SESSION_CAP = 60;
const DELIVERY_CAP = 150;

const ROW_COLUMNS = "id, session_id, role, channel, content, created_at";

export type { ChatHistoryMessage } from "./chat-history-model";

export async function fetchChatHistory(input: {
  familyId: string;
  userId: string;
}): Promise<ChatHistoryMessage[] | null> {
  if (process.env.HOMA_CHAT_HISTORY_DISABLED === "1") return null;
  try {
    const supabase = await createSupabaseServerClient();

    const { count: memberCount, error: memberError } = await supabase
      .from("family_members")
      .select("user_id", { count: "exact", head: true })
      .eq("family_id", input.familyId);
    if (memberError) return null;
    const singleAdult = memberCount === 1;

    const mine = await supabase
      .from("conversation_messages")
      .select(ROW_COLUMNS)
      .eq("family_id", input.familyId)
      .eq("visibility", "family")
      .eq("member_user_id", input.userId)
      .order("created_at", { ascending: false })
      .limit(SLICE_LIMIT);
    if (mine.error) return null;

    let legacyMine: ChatHistoryRow[] = [];
    if (singleAdult) {
      const legacy = await supabase
        .from("conversation_messages")
        .select(ROW_COLUMNS)
        .eq("family_id", input.familyId)
        .eq("visibility", "family")
        .eq("role", "user")
        .is("member_user_id", null)
        .order("created_at", { ascending: false })
        .limit(SLICE_LIMIT);
      if (!legacy.error) legacyMine = (legacy.data ?? []) as ChatHistoryRow[];
    }

    const mineRows = (mine.data ?? []) as ChatHistoryRow[];
    const sessionIds = recentSessionIds(
      [...mineRows, ...legacyMine],
      SESSION_CAP,
    );

    let companions: ChatHistoryRow[] = [];
    if (sessionIds.length > 0) {
      const companionQuery = await supabase
        .from("conversation_messages")
        .select(ROW_COLUMNS)
        .eq("family_id", input.familyId)
        .eq("visibility", "family")
        .is("member_user_id", null)
        .in("session_id", sessionIds)
        .order("created_at", { ascending: false })
        .limit(SLICE_LIMIT * 2);
      if (!companionQuery.error) {
        companions = (companionQuery.data ?? []) as ChatHistoryRow[];
      }
    }

    let deliveredQuery = supabase
      .from("conversation_deliveries")
      .select("message_id")
      .eq("family_id", input.familyId)
      .order("created_at", { ascending: false })
      .limit(DELIVERY_CAP);
    deliveredQuery = singleAdult
      ? deliveredQuery.or(
          `recipient_member_user_id.eq.${input.userId},recipient_member_user_id.is.null`,
        )
      : deliveredQuery.eq("recipient_member_user_id", input.userId);
    const delivered = await deliveredQuery;

    let deliveredRows: ChatHistoryRow[] = [];
    const deliveredIds = [
      ...new Set(
        ((delivered.data ?? []) as { message_id: string }[]).map(
          (row) => row.message_id,
        ),
      ),
    ];
    if (!delivered.error && deliveredIds.length > 0) {
      const deliveredMessages = await supabase
        .from("conversation_messages")
        .select(ROW_COLUMNS)
        .eq("family_id", input.familyId)
        .eq("visibility", "family")
        .in("id", deliveredIds)
        .limit(DELIVERY_CAP);
      if (!deliveredMessages.error) {
        deliveredRows = (deliveredMessages.data ?? []) as ChatHistoryRow[];
      }
    }

    return mergeChatHistoryRows(
      [mineRows, legacyMine, companions, deliveredRows],
      HISTORY_CAP,
    );
  } catch {
    return null;
  }
}
