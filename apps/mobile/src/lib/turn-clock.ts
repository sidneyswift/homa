/**
 * Wall-clock latency for chat.turn_completed, ported from
 * apps/web/app/chat/turn-clock.ts: bookkeeping for analytics, not render
 * data. One turn is in flight at a time per chat (eve is
 * one-turn-at-a-time), so a single module slot is enough.
 */

let turnStartedAt: number | null = null;

export function markTurnStarted(): void {
  turnStartedAt = Date.now();
}

/** Returns elapsed ms since markTurnStarted and clears the slot. */
export function takeTurnLatencyMs(): number {
  const startedAt = turnStartedAt;
  turnStartedAt = null;
  if (startedAt === null) return 0;
  return Math.max(0, Date.now() - startedAt);
}
