import { persistCanonicalMessage } from "../../../../../lib/conversation-continuity/ledger";
import { rateLimited } from "../../../../../lib/map/ratelimit";
import { resolveApiFamily } from "../../../../../lib/api-auth";
import { canonicalVoiceSessionId, validVoiceSequence, validVoiceSessionId } from "../../../../../lib/voice/source-turn";

/**
 * POST /api/voice/realtime/turn: records ONE spoken turn in the thread
 * (founder direction 2026-07-29).
 *
 * What changed and why. The first version bundled the whole conversation
 * into a single "here is what we said out loud" message, sent it through
 * eve as if the parent had typed it, and text Homa replied to it. That made
 * two conversations pretend to be one, and produced the tell: Homa
 * answering a transcript with "that's a very short call!". A voice turn is
 * not a message about a conversation, it IS a turn in the conversation.
 *
 * So each turn lands as its own row, the moment it is said, exactly as a
 * typed turn does. Same table, same thread, same session, same episode.
 * `modality: "voice"` is the only difference, and it exists so the thread
 * can render it as spoken and so Homa can later know it was said rather
 * than typed.
 *
 * This route deliberately DOES NOT run an eve turn. Text Homa must not
 * answer what voice Homa just said: that would be Homa replying to herself
 * in front of the parent. The turns become context for the NEXT thing the
 * parent types, through the per-turn context block, which is the same way
 * phone calls reach her (lib/voice/recent-calls.ts).
 *
 * Idempotent on (sessionId, sequence): the client can retry a failed write
 * without doubling a line, and a reconnect that replays cannot duplicate
 * the conversation.
 *
 * familyId is never read from the request. It comes from the caller's own
 * membership row under their own RLS.
 */

/** Generous for a conversation, low enough that a loop cannot fill the
 * thread. A talkative ten minutes is well inside this. */
const MAX_TURNS_PER_USER_PER_HOUR = 400;
const HOUR_MS = 60 * 60 * 1000;

interface TurnBody {
  sessionId?: unknown;
  sequence?: unknown;
  role?: unknown;
  content?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const { familyId, userId } = auth;

  if (rateLimited(`realtime-turn:${userId}`, MAX_TURNS_PER_USER_PER_HOUR, HOUR_MS)) {
    return Response.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  let body: TurnBody;
  try {
    body = (await request.json()) as TurnBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const role = body.role === "user" || body.role === "assistant" ? body.role : null;
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!validVoiceSessionId(body.sessionId) || !validVoiceSequence(body.sequence) || !role || content.length === 0 || content.length > 8_000) {
    return Response.json({ ok: false, reason: "bad-turn" }, { status: 400 });
  }
  const sessionId = canonicalVoiceSessionId(familyId, userId, body.sessionId);
  const sequence = body.sequence;

  try {
    const persisted = await persistCanonicalMessage({
      attributes: { familyId, memberUserId: userId },
      sessionId,
      // Web, because that is where this happened. Spoken-ness is modality,
      // not channel: calling it something else would quietly change how the
      // usage ledger and ~15 per-tool channel guards treat it.
      channel: "web",
      sequence,
      role,
      content,
      turnId: `${sessionId}:${sequence}`,
      // Assistant turns are final when written: a realtime turn is spoken
      // once and never revised, unlike a streamed text turn.
      terminal: role === "assistant",
      modality: "voice",
    });
    if (!persisted) throw new Error("voice turn was not saved");
  } catch (error) {
    console.error(
      "voice turn persist failed:",
      error instanceof Error ? error.message : "unknown",
    );
    // The conversation is still happening and she can still hear Homa. A
    // lost line is worth a log, never a broken session.
    return Response.json({ ok: false, reason: "not-saved" }, { status: 200 });
  }

  return Response.json({ ok: true });
}
