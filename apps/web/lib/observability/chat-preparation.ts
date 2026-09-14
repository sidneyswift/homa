/** Metadata only: never pass auth attributes, message text, or database rows. */
export type ChatPreparationStage =
  | "model_input_ready"
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
  | "family_context_recovered"
  | "family_context_degraded"
  | "session_binding"
  | "session_lock_wait"
  | "binding_authenticate"
  | "binding_membership"
  | "binding_read"
  | "binding_total"
  | "user_persistence"
  | "embedding_total"
  | "embedding_provider"
  | "embedding_usage"
  | "canonical_persistence"
  | "canonical_episode"
  | "canonical_transaction"
  | "embedding_update"
  | "agent_step_started"
  | "first_message_appended";

export interface ChatPreparationMetadata {
  turnId?: string;
  role?: "user" | "assistant";
  sequence?: number;
  stepIndex?: number;
  source?: "send" | "restore";
  statusCode?: number;
}

export interface ChatPreparationTrace extends ChatPreparationMetadata {
  sessionId?: string;
}

/** Explicit fields only. Never spread caller objects into a timing record. */
export function recordChatPreparationTiming(
  stage: ChatPreparationStage,
  startedAtMs: number,
  durationMs: number,
  outcome: "ok" | "error",
  sessionId?: string,
  metadata?: ChatPreparationMetadata,
): void {
  try {
    console.info("[chat-preparation]", JSON.stringify({
      stage,
      startedAtMs,
      durationMs: Math.round(durationMs),
      outcome,
      ...(sessionId ? { sessionId } : {}),
      ...(metadata?.turnId ? { turnId: metadata.turnId } : {}),
      ...(metadata?.role ? { role: metadata.role } : {}),
      ...(metadata?.sequence !== undefined ? { sequence: metadata.sequence } : {}),
      ...(metadata?.stepIndex !== undefined ? { stepIndex: metadata.stepIndex } : {}),
      ...(metadata?.source ? { source: metadata.source } : {}),
      ...(metadata?.statusCode !== undefined ? { statusCode: metadata.statusCode } : {}),
    }));
  } catch {
    // Logging must never change the observed operation's behavior.
  }
}

export function markChatPreparation(
  stage: ChatPreparationStage,
  sessionId?: string,
  metadata?: ChatPreparationMetadata,
): void {
  recordChatPreparationTiming(stage, Date.now(), 0, "ok", sessionId, metadata);
}

export async function measureChatPreparation<T>(
  stage: ChatPreparationStage,
  operation: () => Promise<T>,
  sessionId?: string,
  metadata?: ChatPreparationMetadata,
): Promise<T> {
  const startedAtMs = Date.now();
  const startedAt = performance.now();
  let outcome: "ok" | "error" = "error";
  try {
    const result = await operation();
    outcome = "ok";
    return result;
  } finally {
    recordChatPreparationTiming(
      stage, startedAtMs, performance.now() - startedAt, outcome, sessionId, metadata,
    );
  }
}
