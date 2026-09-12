/** Metadata only: never pass auth attributes, message text, or database rows. */
export type ChatPreparationStage =
  | "authenticate"
  | "membership"
  | "account_gate"
  | "inbound_continuity"
  | "family_rows"
  | "progress"
  | "onboarding"
  | "continuity"
  | "recent_calls"
  | "family_context_total"
  | "session_binding";

export async function measureChatPreparation<T>(
  stage: ChatPreparationStage,
  operation: () => Promise<T>,
  sessionId?: string,
): Promise<T> {
  const startedAt = performance.now();
  let outcome: "ok" | "error" = "error";
  try {
    const result = await operation();
    outcome = "ok";
    return result;
  } finally {
    // Logging must never turn a successful read into a failed turn.
    try {
      console.info("[chat-preparation]", JSON.stringify({
        stage,
        durationMs: Math.round(performance.now() - startedAt),
        outcome,
        ...(sessionId ? { sessionId } : {}),
      }));
    } catch {
      // Timing is best effort and has no durable side effects.
    }
  }
}
