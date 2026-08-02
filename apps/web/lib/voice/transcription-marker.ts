/**
 * Durable, cross-channel provenance for speech that became text.
 *
 * Request headers and database modality columns are exact transport and
 * storage metadata, but neither becomes part of Eve's replayed message
 * history. This marker does. The model and recall read it; the transcript
 * renderer removes only the prefix and keeps the parent's words visible.
 */

export const VOICE_TRANSCRIPTION_MARKER = "[Voice note, transcribed]";

const VOICE_TRANSCRIPTION_PREFIX = `${VOICE_TRANSCRIPTION_MARKER}:`;

export function isVoiceTranscriptionText(text: string): boolean {
  return text.split("\n").some((line) => {
    const trimmed = line.trimStart();
    return (
      trimmed === VOICE_TRANSCRIPTION_MARKER ||
      trimmed.startsWith(`${VOICE_TRANSCRIPTION_PREFIX} `)
    );
  });
}

export function markVoiceTranscription(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0 || isVoiceTranscriptionText(trimmed)) return trimmed;
  return `${VOICE_TRANSCRIPTION_PREFIX} ${trimmed}`;
}

/** Removes one exact marker prefix from a rendered line, never its words. */
export function stripVoiceTranscriptionMarker(line: string): string {
  const trimmed = line.trimStart();
  if (trimmed === VOICE_TRANSCRIPTION_MARKER) return "";
  if (!trimmed.startsWith(`${VOICE_TRANSCRIPTION_PREFIX} `)) return line;
  return trimmed.slice(VOICE_TRANSCRIPTION_PREFIX.length).trimStart();
}
