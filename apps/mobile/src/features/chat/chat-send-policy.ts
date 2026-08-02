/**
 * The mobile twin of apps/web/app/app/chat-send-policy.ts's function of
 * the same name (keep behavior aligned until a shared package exists,
 * M1-17 shape).
 *
 * isSendLineOccupied({busy, recovering}): whether a manual send right now
 * would land on a turn that already has an unsettled outcome, and so must
 * queue instead of starting a fresh eve session.
 *
 * `busy` alone used to be the whole answer, but that misses a real
 * window: when a stream dies mid-turn without a closing boundary event
 * (a subway losing signal, a dropped cell handoff, the exact scenario a
 * phone hits far more than a laptop), eve's own client wipes its local
 * session cursor (advanceSession in eve's session-utils, no fix
 * available from here), so `agent.session?.sessionId` goes back to
 * undefined even though the durable turn is very likely still finishing
 * server-side. `agent.status` flips to "error" in that same moment, so
 * `busy` is already false. Lost-turn recovery (lib/turn-recovery.ts)
 * exists exactly to find out whether that old turn settled, but it can
 * take up to RECOVERY_DEADLINE_MS (chat-session.tsx) to decide. A manual
 * send in that window used to see no session id and no "busy" status,
 * and started a brand new eve session while the old one was still very
 * much alive: two sessions running for the same family, whichever one
 * she is not looking at when its reply lands is the one that reads as
 * "my message disappeared". That is exactly the fork GH #170 confirmed
 * live on web (the 2026-07-24/25 co-founder incidents); this app has
 * the identical `recoveryRef`/`recovering`/busy shape and has not been
 * reported for it yet only because it is new. Recovering is exactly
 * that undecided window, so it occupies the line the same way busy does.
 */
export function isSendLineOccupied(input: {
  busy: boolean;
  recovering: boolean;
}): boolean {
  return input.busy || input.recovering;
}

export interface QueuedChatMessage {
  text: string;
  lane: "parent" | "directive";
  clientContext?: ProgressClientContext;
  headers?: Readonly<Record<string, string>>;
}

export type ProgressDraftIntent =
  | "share_progress_evidence"
  | "review_progress_next_move";

export type ProgressClientContext = Readonly<Record<string, string>> & {
  readonly source: "progress";
  readonly intent: ProgressDraftIntent;
  readonly progressChildId: string;
};

/**
 * Takes exactly one model turn from the queue. Adjacent parent messages may
 * share a turn, but a hidden directive always travels alone.
 */
export function takeNextQueuedTurn(
  queue: readonly QueuedChatMessage[],
): {
  message: string;
  clientContext?: ProgressClientContext;
  headers?: Readonly<Record<string, string>>;
  remaining: QueuedChatMessage[];
} | null {
  const first = queue[0];
  if (!first) return null;
  if (first.lane === "directive" || first.clientContext || first.headers) {
    return {
      message: first.text,
      ...(first.clientContext ? { clientContext: first.clientContext } : {}),
      ...(first.headers ? { headers: first.headers } : {}),
      remaining: queue.slice(1),
    };
  }
  const boundary = queue.findIndex(
    (entry) =>
      entry.lane === "directive" ||
      entry.clientContext !== undefined ||
      entry.headers !== undefined,
  );
  const count = boundary === -1 ? queue.length : boundary;
  return {
    message: queue.slice(0, count).map((entry) => entry.text).join("\n\n"),
    remaining: queue.slice(count),
  };
}
