import { Client } from "eve/client";
import type { HandleMessageStreamEvent } from "eve/client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { EVE_CHANNEL_HEADER } from "./env";

/**
 * Lost-turn recovery, the mobile twin of
 * apps/web/app/app/turn-recovery.ts (keep behavior aligned until a
 * shared package exists, M1-17 shape). When the chat stream dies past
 * saving, the durable run usually finishes anyway, so the reply exists
 * server-side while the screen shows an error. recoverLostTurn finds
 * the interrupted session and replays its durable event stream so the
 * chat can fold the whole conversation, reply included, back into the
 * transcript.
 *
 * Two steps, both tenant-safe and read-only:
 *
 *   1. Re-learn the session id. The eve client wipes its session cursor
 *      when a stream dies mid-turn (no boundary event = reset), so the
 *      id comes back from conversation_messages: the persist hook
 *      writes the user message within seconds of the turn starting, and
 *      members read only their own rows through RLS. The row must match
 *      the sent text exactly and postdate the send, so a same-text
 *      message from another day can never resurrect the wrong session.
 *   2. Replay the durable stream from index 0 (eve's resumable-streams
 *      design) until the session settles. session.waiting closes EVERY
 *      turn, so the replay passes earlier turns' boundaries on the way
 *      down; only a boundary the live client never received (index at
 *      or past its durable cursor) closes the interrupted turn. If the
 *      turn is still running server-side, the stream keeps delivering
 *      until it ends, which is exactly the wait she chose by staying.
 *
 * Fail-soft contract: null on any failure (offline, no persisted row,
 * replay error, abort, server-declared failure), and the caller keeps
 * the plain error banner. Nothing here writes anything.
 */

/** Matches the chat surfaces' setting: a phone sleeping repeatedly
 *  through a long replay burns one reconnect per wake. */
const REPLAY_RECONNECT_ATTEMPTS = 8;

/** The persist hook stores content trimmed and capped at 8000 chars
 *  (apps/web/lib/conversation-log.ts); matching mirrors that. */
const PERSISTED_CONTENT_MAX_CHARS = 8000;

/** Clock slack between the client marking the send and the server row's
 *  created_at, generous for phones with drifting clocks. */
const SENT_AT_SLACK_MS = 60_000;

/** The persist hook needs a beat to land the user-message row (an
 *  embedding call rides in it); a few short retries cover it without
 *  holding a genuinely dead turn's error banner back for long. */
const SESSION_LOOKUP_ATTEMPTS = 4;
const SESSION_LOOKUP_RETRY_MS = 2_500;

export interface RecoveredTurn {
  /** Every durable event of the session, through the closing boundary. */
  events: HandleMessageStreamEvent[];
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done);
  });
}

/** The session id of the web-channel turn that carried exactly this
 *  user message, from the family's own conversation record (RLS). The
 *  eve channel labels app sessions "web" on this surface too. */
async function findWebSessionIdByUserMessage(
  supabase: SupabaseClient,
  sentText: string,
  sentAtMs: number,
): Promise<string | null> {
  const target = sentText.trim().slice(0, PERSISTED_CONTENT_MAX_CHARS);
  if (target.length === 0) return null;

  const { data } = await supabase
    .from("conversation_messages")
    .select("session_id, content")
    .eq("channel", "web")
    .eq("role", "user")
    .gte("created_at", new Date(sentAtMs - SENT_AT_SLACK_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  const rows = (data ?? []) as { session_id: string; content: string }[];
  return rows.find((row) => row.content === target)?.session_id ?? null;
}

/** Replays the durable stream until a boundary the live client never
 *  received settles the session. Null unless it settles cleanly. */
async function replaySessionToBoundary(input: {
  sessionId: string;
  minBoundaryIndex: number;
  host: string;
  bearer: () => Promise<string>;
  signal: AbortSignal;
}): Promise<RecoveredTurn | null> {
  const client = new Client({
    auth: { bearer: input.bearer },
    host: input.host,
    headers: EVE_CHANNEL_HEADER,
    maxReconnectAttempts: REPLAY_RECONNECT_ATTEMPTS,
  });
  const session = client.session({
    sessionId: input.sessionId,
    streamIndex: 0,
  });

  const events: HandleMessageStreamEvent[] = [];
  for await (const event of session.stream({
    startIndex: 0,
    signal: input.signal,
  })) {
    events.push(event);
    if (events.length - 1 < input.minBoundaryIndex) continue;
    if (event.type === "session.waiting" || event.type === "session.completed") {
      return { events };
    }
    // The server itself declared the turn or session failed: there is
    // no reply to recover, the error banner is the truth. step.failed
    // is NOT terminal (the runtime retries model calls).
    if (event.type === "session.failed" || event.type === "turn.failed") {
      return null;
    }
  }
  // Stream closed without settling the interrupted turn.
  return null;
}

/**
 * recoverLostTurn({...}): the full recovery, or null when the turn is
 * genuinely unrecoverable. Never throws; abort the signal to give up
 * (navigation, a new send taking over the composer).
 */
export async function recoverLostTurn(input: {
  supabase: SupabaseClient;
  /** Exactly what agent.send carried (queue-joined form included). */
  sentText: string;
  sentAtMs: number;
  /** The live client's durable event cursor when the stream died:
   *  session streamIndex at mount plus events received since. */
  minBoundaryIndex: number;
  /** The eve host (EXPO_PUBLIC_API_URL on this surface). */
  host: string;
  bearer: () => Promise<string>;
  signal: AbortSignal;
}): Promise<RecoveredTurn | null> {
  try {
    let sessionId: string | null = null;
    for (let attempt = 0; attempt < SESSION_LOOKUP_ATTEMPTS; attempt += 1) {
      if (input.signal.aborted) return null;
      sessionId = await findWebSessionIdByUserMessage(
        input.supabase,
        input.sentText,
        input.sentAtMs,
      );
      if (sessionId) break;
      await sleep(SESSION_LOOKUP_RETRY_MS, input.signal);
    }
    if (!sessionId || input.signal.aborted) return null;

    return await replaySessionToBoundary({
      sessionId,
      minBoundaryIndex: input.minBoundaryIndex,
      host: input.host,
      bearer: input.bearer,
      signal: input.signal,
    });
  } catch {
    return null;
  }
}
