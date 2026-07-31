/**
 * What the Homa character is doing right now, derived from the same
 * signals the chat session already tracks. Pure and total on purpose:
 * the voice screen recomputes it every render and the character rig
 * (homa-character.tsx) animates whatever comes back.
 *
 * Precedence, most alive first:
 *
 * 1. speaking: assistant text is streaming in, so she is talking, even
 *    though the turn is of course still active underneath.
 * 2. thinking: a turn is active but nothing is streaming yet, the
 *    silent tool-call window that can run 60-90 seconds and must never
 *    look frozen.
 * 3. listening: the composer is focused, she leans in and pays
 *    attention before anything has been sent.
 * 4. idle: nobody is doing anything, she floats and waits.
 */

export type CharacterState = "idle" | "listening" | "thinking" | "speaking";

export interface CharacterInputs {
  composerFocused: boolean;
  turnActive: boolean;
  assistantTextStreaming: boolean;
}

export function deriveCharacterState(inputs: CharacterInputs): CharacterState {
  if (inputs.assistantTextStreaming) return "speaking";
  if (inputs.turnActive) return "thinking";
  if (inputs.composerFocused) return "listening";
  return "idle";
}
