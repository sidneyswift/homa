import type { HandleMessageStreamEvent } from "eve/client";

interface ReplayOptions {
  readonly startIndex: number;
  readonly signal: AbortSignal;
}

interface ReplaySession<TEvent> {
  stream(options: ReplayOptions): AsyncIterable<TEvent>;
}

/** Recovery depends only on reading, never on creation, send, or input response. */
export type EveReplayClient<TEvent = HandleMessageStreamEvent> = {
  session(state: { sessionId: string; streamIndex: number }): ReplaySession<TEvent>;
} | {
  readonly sessions: {
    attach(sessionId: string, options: { streamIndex: number }): ReplaySession<TEvent>;
  };
};

export function attachEveSessionForReplay<TEvent>(
  client: EveReplayClient<TEvent>,
  sessionId: string,
): ReplaySession<TEvent> {
  if (!sessionId || sessionId.trim() !== sessionId) throw new Error("Replay requires an existing session ID.");
  const session = "sessions" in client
    ? client.sessions.attach(sessionId, { streamIndex: 0 })
    : client.session({ sessionId, streamIndex: 0 });
  return { stream: options => session.stream(options) };
}
