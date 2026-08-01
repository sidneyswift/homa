export type ConversationMessageModality = "text" | "voice";

export const HOMA_MESSAGE_MODALITY_HEADER = "x-homa-message-modality";
export const HOMA_VOICE_BRIDGE_HEADER = "x-homa-voice-bridge";

export function messageModalityFromRequest(
  request: Request,
): ConversationMessageModality {
  return request.headers.get(HOMA_MESSAGE_MODALITY_HEADER) === "voice"
    ? "voice"
    : "text";
}

export function messageModalityHeaders(
  modality: ConversationMessageModality,
): Readonly<Record<string, string>> {
  return { [HOMA_MESSAGE_MODALITY_HEADER]: modality };
}

export function voiceTranscriptionContext(
  modality: ConversationMessageModality,
): string[] {
  if (modality !== "voice") return [];
  return [
    [
      "## Voice transcription",
      "",
      "This message includes words the parent spoke. The words are a voice transcription, and the audio is not retained. If she asks whether Homa received what she said, confirm that the transcribed words arrived. Do not deny that she spoke it, and do not claim that an audio file was saved.",
    ].join("\n"),
  ];
}
