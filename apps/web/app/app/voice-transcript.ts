/**
 * Deciding which turns of a live realtime session are finished, and so
 * belong in the chat thread (issue #283, founder direction 2026-07-29).
 *
 * Pure on purpose. A spoken conversation otherwise exists only as sound, so
 * the part that decides what becomes a message must be testable without a
 * microphone, a socket, or a model.
 */

export interface VoiceTranscriptLine {
  role: "assistant" | "user";
  text: string;
}

/** One entry in the realtime store, whose words may still be arriving. */
export interface VoiceTurn extends VoiceTranscriptLine {
  /** The realtime message's own id, stable across deltas. */
  id: string;
}

interface RealtimeMessageLike {
  id?: unknown;
  role?: unknown;
  parts?: unknown;
}

/** The spoken text of one message, joined across however many delta parts
 * arrived. Non-text parts (audio, tool calls) carry nothing to read. */
function spokenText(message: RealtimeMessageLike): string {
  if (!Array.isArray(message.parts)) return "";
  return message.parts
    .map((part) => {
      const candidate = part as { type?: unknown; text?: unknown };
      return candidate.type === "text" && typeof candidate.text === "string"
        ? candidate.text
        : "";
    })
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Every turn the session has, oldest first, INCLUDING ones with no words yet.
 *
 * Keeping the empty ones is the whole point. Speech transcription is
 * asynchronous: a turn can exist with its audio already sent and its text
 * still coming, and Homa can begin answering before the parent's words land.
 * Filtering the blank out would renumber every turn after it, so it stays
 * visible to the caller as a "wait here".
 */
export function voiceTurns(messages: readonly unknown[]): VoiceTurn[] {
  const turns: VoiceTurn[] = [];
  for (const raw of messages) {
    // The messages come from the SDK's own store, so the shape is not ours
    // to guarantee. Losing a whole conversation to one unexpected entry is
    // the worst outcome here, so anything unreadable is skipped rather than
    // thrown on.
    if (typeof raw !== "object" || raw === null) continue;
    const message = raw as RealtimeMessageLike;
    const role =
      message.role === "assistant"
        ? "assistant"
        : message.role === "user"
          ? "user"
          : null;
    if (role === null) continue;
    turns.push({
      id: typeof message.id === "string" ? message.id : `turn-${turns.length}`,
      role,
      text: spokenText(message),
    });
  }
  return turns;
}

/** The readable transcript, silent turns dropped. */
export function transcriptFromRealtimeMessages(
  messages: readonly unknown[],
): VoiceTranscriptLine[] {
  return voiceTurns(messages)
    .filter((turn) => turn.text.length > 0)
    .map(({ role, text }) => ({ role, text }));
}

/**
 * The next run of turns that are done arriving and can go in the thread.
 *
 * Two rules, and each exists because of a specific way this goes wrong.
 *
 * A turn is finished only once a LATER turn exists, because until then its
 * words are still landing in deltas and writing it would put half a sentence
 * in the thread. On the way out everything is finished, since nothing more is
 * coming.
 *
 * Turns are released strictly in order, stopping at the first one that could
 * still fill in. Speech transcription is asynchronous, so the parent's words
 * can arrive AFTER Homa has started answering them. Stepping over the blank
 * and taking Homa's reply first would put her answer above the question, and
 * would renumber the parent's words into a sequence already spent: the write
 * would land as a second copy of Homa's turn while the parent's own words
 * never appeared at all. Waiting costs a moment. That costs the conversation.
 *
 * `cursor` is the position after the last released turn. Sequence is the
 * turn's position in the session, stable because the store only ever appends,
 * which makes the write idempotent on (sessionId, sequence): a retry cannot
 * double a line and a replay cannot double a conversation.
 */
export function settledTurns(
  turns: readonly VoiceTurn[],
  cursor: number,
  finished: boolean,
): {
  cursor: number;
  lines: { sequence: number; line: VoiceTranscriptLine }[];
} {
  const lines: { sequence: number; line: VoiceTranscriptLine }[] = [];
  let next = cursor;
  for (let index = cursor; index < turns.length; index += 1) {
    // Still being spoken right now.
    if (index === turns.length - 1 && !finished) break;
    const turn = turns[index];
    if (turn.text.length === 0) {
      // No words yet. Once the session is over they are never coming, so
      // that was silence and the thread skips it. Otherwise wait, in place.
      if (!finished) break;
      next = index + 1;
      continue;
    }
    lines.push({ sequence: index, line: { role: turn.role, text: turn.text } });
    next = index + 1;
  }
  return { cursor: next, lines };
}

/**
 * One settled turn as a chat message, ready to render in the thread.
 *
 * A spoken turn is an ordinary message and renders as one: same bubble, same
 * column, same thread. Its id lives in its own namespace because eve's turn
 * ids restart with every session and a spoken turn belongs to no eve turn at
 * all (no eve turn runs for it, deliberately).
 */
export function spokenTurnMessage(
  line: VoiceTranscriptLine,
  sequence: number,
): {
  id: string;
  role: "assistant" | "user";
  parts: { type: "text"; text: string }[];
} {
  return {
    id: `spoken:${sequence}:${line.role}`,
    role: line.role,
    parts: [{ type: "text", text: line.text }],
  };
}
