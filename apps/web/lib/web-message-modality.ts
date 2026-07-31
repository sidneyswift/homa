export type ConversationMessageModality = "text" | "voice";

export const HOMA_MESSAGE_MODALITY_HEADER = "x-homa-message-modality";

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
      "This web chat message includes words the parent dictated. The dictated words are a voice transcription, and the audio is not retained. If she asks whether Homa received the voice note, confirm that the transcribed words arrived. Do not deny that she spoke it, and do not claim that an audio file was saved.",
    ].join("\n"),
  ];
}
