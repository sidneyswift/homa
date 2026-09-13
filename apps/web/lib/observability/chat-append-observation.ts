interface AppendData {
  readonly turnId: string;
  readonly messageDelta: string;
  readonly messageSoFar?: string;
}

export type ChatAppendObservation = "first_message_appended" | "first_observed_message_append";

/**
 * Old streams expose cumulative text; new streams expose only deltas. The latter
 * can prove only this worker's first observation, not the turn's first append.
 * A bounded cache avoids per-token logging. Eviction/restarts may repeat that
 * observation, so analysis must not treat the marker as a global first-token fact.
 * This diagnostic cache is not conversation state and never holds message text.
 */
export function createChatAppendObserver(maxTurns = 512) {
  if (!Number.isInteger(maxTurns) || maxTurns < 1) throw new Error("Invalid append observation cache size.");
  const observed = new Map<string, true>();
  return (sessionId: string, data: AppendData): ChatAppendObservation | undefined => {
    if (!data.messageDelta.length) return undefined;
    if (typeof data.messageSoFar === "string") {
      return data.messageSoFar.length === data.messageDelta.length ? "first_message_appended" : undefined;
    }
    const key = JSON.stringify([sessionId, data.turnId]);
    if (observed.has(key)) return undefined;
    if (observed.size >= maxTurns) observed.delete(observed.keys().next().value!);
    observed.set(key, true);
    return "first_observed_message_append";
  };
}
