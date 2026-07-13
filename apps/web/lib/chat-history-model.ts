/**
 * Pure model for the server-rendered chat history (the M1-02 render
 * slice, founder cut 2026-07-12): the web transcript's scrollback comes
 * from public.conversation_messages instead of the device's localStorage
 * cache, so every device shows the same one thread.
 *
 * Privacy shape (ruling chat-privacy-per-adult, 2026-07-12): an adult
 * sees only their own conversations plus messages Homa addressed to
 * them. The fetch layer (chat-history.ts) queries three per-adult
 * slices; this module is the channel/role vocabulary plus the pure
 * merge those queries share. Pure on purpose: node --test covers it
 * without a database.
 */

import type { EveMessage } from "eve/client";

export type ChatHistoryChannel = "web" | "sms" | "email" | "dispatch";

export interface ChatHistoryMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  channel: ChatHistoryChannel;
  content: string;
  /** created_at as epoch ms, the transcript's day-separator clock. */
  atMs: number;
}

/** Raw row shape as selected from conversation_messages. */
export interface ChatHistoryRow {
  id: string;
  session_id: string;
  role: string;
  channel: string;
  content: string | null;
  created_at: string;
}

const CHANNELS: readonly ChatHistoryChannel[] = [
  "web",
  "sms",
  "email",
  "dispatch",
];

export function toChatHistoryMessage(
  row: ChatHistoryRow,
): ChatHistoryMessage | null {
  if (row.role !== "user" && row.role !== "assistant") return null;
  if (!CHANNELS.includes(row.channel as ChatHistoryChannel)) return null;
  const content = (row.content ?? "").trim();
  if (content.length === 0) return null;
  const atMs = Date.parse(row.created_at);
  if (Number.isNaN(atMs)) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    channel: row.channel as ChatHistoryChannel,
    content,
    atMs,
  };
}

/**
 * mergeChatHistoryRows(batches, cap): one transcript from the per-adult
 * query slices. Rows dedupe by id (a delivered web reply appears in both
 * the session slice and the delivery slice), sort oldest first, and only
 * the most recent `cap` messages survive (the render archive stays
 * bounded; recall covers the deep past).
 */
export function mergeChatHistoryRows(
  batches: readonly (readonly ChatHistoryRow[])[],
  cap: number,
): ChatHistoryMessage[] {
  const byId = new Map<string, ChatHistoryMessage>();
  for (const batch of batches) {
    for (const row of batch) {
      const message = toChatHistoryMessage(row);
      if (message && !byId.has(message.id)) byId.set(message.id, message);
    }
  }
  const merged = [...byId.values()].sort(
    (a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id),
  );
  return merged.length > cap ? merged.slice(merged.length - cap) : merged;
}

/**
 * archiveFromServerHistory(history, excludeSessionId): server rows in
 * the render archive's shape. The current live eve session's rows are
 * excluded: the live store replays those from its own event log, and
 * rendering both would double every message. The minimal EveMessage
 * built here (id, role, one text part) is exactly what the transcript
 * renderer reads; richer parts (tool cards) exist only in live
 * sessions. The `hist:` id prefix keeps server ids from ever colliding
 * with eve's per-session turn ids.
 */
export function archiveFromServerHistory(
  history: readonly ChatHistoryMessage[],
  excludeSessionId: string | undefined,
): { at: number; channel: ChatHistoryChannel; message: EveMessage }[] {
  return history
    .filter((entry) => entry.sessionId !== excludeSessionId)
    .map((entry) => ({
      at: entry.atMs,
      channel: entry.channel,
      message: {
        id: `hist:${entry.id}`,
        role: entry.role,
        parts: [{ type: "text", text: entry.content }],
      } as EveMessage,
    }));
}

/**
 * recentSessionIds(rows, cap): the distinct sessions behind an adult's
 * own messages, newest first, capped so the companion-row query's IN
 * list stays a sane URL. Sessions are how Homa's replies (stored with
 * no member attribution) get tied back to the adult who was talking.
 */
export function recentSessionIds(
  rows: readonly ChatHistoryRow[],
  cap: number,
): string[] {
  const ordered = [...rows].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  const seen = new Set<string>();
  for (const row of ordered) {
    if (row.session_id) seen.add(row.session_id);
    if (seen.size >= cap) break;
  }
  return [...seen];
}
