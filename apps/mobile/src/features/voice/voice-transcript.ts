/** One spoken turn, retaining even an empty placeholder while its transcript arrives. */
export interface VoiceTurn {
  id: string;
  role: "assistant" | "user";
  text: string;
}

/**
 * Releases only consecutive completed turns. An empty non-final entry is a
 * transcription still in flight, not permission to publish its later reply.
 */
export function settledTurns(
  turns: readonly VoiceTurn[],
  cursor: number,
  finished: boolean,
): {
  cursor: number;
  lines: { sequence: number; line: Pick<VoiceTurn, "role" | "text"> }[];
} {
  const lines: { sequence: number; line: Pick<VoiceTurn, "role" | "text"> }[] = [];
  let next = cursor;
  for (let index = cursor; index < turns.length; index += 1) {
    if (index === turns.length - 1 && !finished) break;
    const turn = turns[index];
    if (turn.text.length === 0) {
      if (!finished) break;
      next = index + 1;
      continue;
    }
    lines.push({ sequence: index, line: { role: turn.role, text: turn.text } });
    next = index + 1;
  }
  return { cursor: next, lines };
}
