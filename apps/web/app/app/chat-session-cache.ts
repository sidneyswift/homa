import type { HandleMessageStreamEvent, SessionState } from "eve/client";

export interface SessionEventCache {
  events?: readonly HandleMessageStreamEvent[];
  session?: SessionState;
  messageTimes?: Record<string, number>;
  lastActivityAt?: number;
}

/** Serializes one adult's web turns across tabs in the same browser. */
export async function withChatTurnLock<T>(
  storageKey: string,
  operation: () => Promise<T>,
): Promise<T> {
  const locks = globalThis.navigator?.locks;
  if (!locks) return await operation();
  return await locks.request(`homa-chat-turn:${storageKey}`, operation);
}

/** True when the completed cursor saved by another tab supersedes this tab. */
export function shouldAdoptSavedSession(
  current: SessionState,
  saved: SessionState | undefined,
): saved is SessionState & { sessionId: string } {
  return Boolean(
    saved?.sessionId &&
      (saved.sessionId !== current.sessionId ||
        saved.streamIndex > current.streamIndex),
  );
}

function sessionEventRange(chat: SessionEventCache): {
  sessionId: string;
  start: number;
  end: number;
  events: readonly HandleMessageStreamEvent[];
} | null {
  const sessionId = chat.session?.sessionId;
  const end = chat.session?.streamIndex;
  if (!sessionId || typeof end !== "number" || end < 0) return null;
  const events = chat.events ?? [];
  return {
    sessionId,
    start: Math.max(0, end - events.length),
    end,
    events,
  };
}

/**
 * Merges two tabs' event snapshots by their absolute Eve stream ranges. A tab
 * mounted at cursor N records only events N onward, while an older tab may
 * later try to write its stale 0..N snapshot. Range ordering preserves both
 * the prefix and the newest cursor without guessing from event contents.
 */
export function mergeSavedSessionEvents<T extends SessionEventCache>(
  saved: T,
  incoming: T,
): T {
  const previous = sessionEventRange(saved);
  const next = sessionEventRange(incoming);
  if (!previous || !next || previous.sessionId !== next.sessionId) {
    return incoming;
  }

  let events: readonly HandleMessageStreamEvent[];
  let session: SessionState;
  if (next.end < previous.end) {
    events = previous.events;
    session = saved.session ?? incoming.session ?? { streamIndex: 0 };
  } else if (next.end === previous.end) {
    const nextCoversMore = next.start < previous.start;
    events = nextCoversMore ? next.events : previous.events;
    session = nextCoversMore
      ? (incoming.session ?? { streamIndex: 0 })
      : (saved.session ?? { streamIndex: 0 });
  } else if (next.start <= previous.start) {
    events = next.events;
    session = incoming.session ?? { streamIndex: 0 };
  } else if (next.start <= previous.end) {
    events = [
      ...previous.events,
      ...next.events.slice(previous.end - next.start),
    ];
    session = incoming.session ?? { streamIndex: 0 };
  } else {
    // A gap cannot be replayed coherently. Keep the newer cursor and range;
    // Postgres remains the render source for the missing scrollback.
    events = next.events;
    session = incoming.session ?? { streamIndex: 0 };
  }

  return {
    ...incoming,
    events,
    session,
    messageTimes: {
      ...(saved.messageTimes ?? {}),
      ...(incoming.messageTimes ?? {}),
    },
    lastActivityAt: Math.max(
      saved.lastActivityAt ?? 0,
      incoming.lastActivityAt ?? 0,
    ),
  };
}
