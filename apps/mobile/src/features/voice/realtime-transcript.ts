import { type VoiceTurn } from "./voice-transcript";

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
    item?: { id?: unknown; role?: unknown; type?: unknown };
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
    return [...turns, { id: value.item.id, role: value.item.role, text: "" }];
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
