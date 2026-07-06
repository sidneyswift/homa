/**
 * Wall-clock latency for chat.turn_completed, kept outside component state
 * on purpose: it is bookkeeping for analytics, not render data (and the
 * react-hooks purity rules rightly refuse Date.now in render scope). One
 * turn is in flight at a time per chat (eve is one-turn-at-a-time), so a
 * single module slot is enough.
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
