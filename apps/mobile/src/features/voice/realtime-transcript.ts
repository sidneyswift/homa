import { type VoiceTurn } from "./voice-transcript";

export interface VoiceSourceTurn {
  text: string;
  sequence: number;
}

/**
 * Keeps OpenAI Realtime's audio transcripts in the order the conversation
 * happened. Audio transcription can arrive after Homa has begun replying,
 * so a transcript event never gets to choose its own position.
 */
export function applyRealtimeTranscriptEvent(
  turns: readonly VoiceTurn[],
  event: unknown,
): readonly VoiceTurn[] {
  if (typeof event !== "object" || event === null) return turns;
  const value = event as {
    type?: unknown;
    item?: {
      id?: unknown;
      role?: unknown;
      type?: unknown;
      content?: unknown;
    };
    item_id?: unknown;
    transcript?: unknown;
  };

  if (
    value.type === "conversation.item.created" &&
    value.item?.type === "message" &&
    (value.item.role === "user" || value.item.role === "assistant") &&
    typeof value.item.id === "string" &&
    !turns.some((turn) => turn.id === value.item?.id)
  ) {
    const inputText = Array.isArray(value.item.content)
      ? value.item.content
          .filter(
            (part): part is { type: "input_text"; text: string } =>
              typeof part === "object" &&
              part !== null &&
              (part as { type?: unknown }).type === "input_text" &&
              typeof (part as { text?: unknown }).text === "string",
          )
          .map((part) => part.text)
          .join("\n")
          .trim()
      : "";
    return [
      ...turns,
      { id: value.item.id, role: value.item.role, text: inputText },
    ];
  }

  const role =
    value.type === "conversation.item.input_audio_transcription.completed"
      ? "user"
      : value.type === "response.output_audio_transcript.done"
        ? "assistant"
        : null;
  if (!role || typeof value.item_id !== "string" || typeof value.transcript !== "string") return turns;
  const text = value.transcript.trim();
  if (text.length === 0) return turns;
  const index = turns.findIndex((turn) => turn.id === value.item_id);
  if (index === -1) return [...turns, { id: value.item_id, role, text }];
  return turns.map((turn, candidate) =>
    candidate === index ? { ...turn, text } : turn,
  );
}

/**
 * Tracks the newest parent item independently from transcription timing. The
 * function call may finish before audio transcription, so an empty current
 * item is safer than reusing the prior parent's words.
 */
export function sourceTurnFromRealtimeEvent(
  turns: readonly VoiceTurn[],
  event: unknown,
  current: VoiceSourceTurn | null,
): VoiceSourceTurn | null {
  if (typeof event !== "object" || event === null) return current;
  const value = event as {
    type?: unknown;
    item?: { id?: unknown; role?: unknown; type?: unknown };
    item_id?: unknown;
  };
  const itemId =
    value.type === "conversation.item.created" &&
    value.item?.type === "message" &&
    value.item.role === "user" &&
    typeof value.item.id === "string"
      ? value.item.id
      : value.type === "conversation.item.input_audio_transcription.completed" &&
          typeof value.item_id === "string"
        ? value.item_id
        : null;
  if (!itemId) return current;
  const sequence = turns.findIndex((turn) => turn.id === itemId && turn.role === "user");
  if (sequence < 0 || (current && sequence < current.sequence)) return current;
  return { text: turns[sequence]?.text ?? "", sequence };
}
