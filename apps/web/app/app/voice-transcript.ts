/**
 * Turning a realtime session's messages into the transcript she reads, and
 * then into the message that lands in her chat (issue #283).
 *
 * Pure on purpose. The transcript is the durable record of a conversation
 * that otherwise exists only as sound, so its assembly is the part that
 * must be testable without a microphone, a socket, or a model.
 */

export interface VoiceTranscriptLine {
  role: "assistant" | "user";
  text: string;
}

interface RealtimeMessageLike {
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
 * The readable transcript, newest last, silent turns dropped.
 *
 * A realtime message can exist with no text yet (audio is still arriving,
 * or it carried only a tool call). Rendering those as empty rows would make
 * the transcript flicker with blanks while Homa thinks, so they wait until
 * they have words.
 */
export function transcriptFromRealtimeMessages(
  messages: readonly unknown[],
): VoiceTranscriptLine[] {
  const lines: VoiceTranscriptLine[] = [];
  for (const raw of messages) {
    // The messages come from the SDK's own store, so the shape is not ours
    // to guarantee. Losing a whole conversation to one unexpected entry is
    // the worst outcome here, so anything unreadable is skipped rather than
    // thrown on.
    if (typeof raw !== "object" || raw === null) continue;
    const message = raw as RealtimeMessageLike;
    const role = message.role === "assistant" ? "assistant" : message.role === "user" ? "user" : null;
    if (role === null) continue;
    const text = spokenText(message);
    if (text.length === 0) continue;
    lines.push({ role, text });
  }
  return lines;
}

/**
 * The transcript as the single chat message that records the conversation.
 *
 * One message rather than a replayed back-and-forth, because these turns
 * did not happen in the chat: rendering them as chat bubbles would claim a
 * history that never existed there, and the next turn's model would read
 * her spoken asides as things she typed. A labelled block is honest about
 * what it is and still fully readable and searchable.
 *
 * Returns null when nothing was said, so a session she opened and closed
 * without speaking leaves no trace rather than an empty note.
 */
export function transcriptAsChatMessage(
  transcript: readonly VoiceTranscriptLine[],
): string | null {
  if (transcript.length === 0) return null;
  const body = transcript
    .map((line) => `${line.role === "assistant" ? "Homa" : "Me"}: ${line.text}`)
    .join("\n");
  return `Here is what we said out loud just now.\n\n${body}`;
}
