/**
 * Converting realtime snapshots and settled spoken turns into chat text.
 * Stable delivery identity and completion belong to WebVoiceSession.
 *
 * Pure on purpose. A spoken conversation otherwise exists only as sound, so
 * the part that decides what becomes a message must be testable without a
 * microphone, a socket, or a model.
 */

export interface VoiceTranscriptLine {
  role: "assistant" | "user";
  text: string;
  /** Stable origin when supplied by the event-driven web voice session. */
  sessionId?: string;
  sequence?: number;
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
 * Read the current SDK snapshot without deciding which turns are complete.
 * SDK 7 may insert late transcripts before existing entries; positions and
 * fallback ids here are for display only, never durable delivery identity.
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
 * One settled turn as a chat message, ready to render in the thread.
 *
 * A spoken turn is an ordinary message and renders as one: same bubble, same
 * column, same thread. Its id lives in its own namespace because eve's turn
 * ids restart with every session. Rendering a spoken turn never submits a
 * second Eve request; action requests already ran through the voice bridge.
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
    id: line.sessionId !== undefined && line.sequence !== undefined
      ? `spoken:${encodeURIComponent(line.sessionId)}:${line.sequence}:${line.role}`
      : `spoken:${sequence}:${line.role}`,
    role: line.role,
    parts: [{ type: "text", text: line.text }],
  };
}
