/** Persisted state also represents a conversation with no active runtime. */
export interface EveSessionCursor {
  sessionId?: string;
  streamIndex: number;
  /** Legacy credential. Handle clients do not issue or send this field. */
  continuationToken?: string;
}

interface MessageInput {
  message: string;
  clientContext?: string;
  signal: AbortSignal;
}
interface HandleOptions {
  clientContext?: string;
  signal: AbortSignal;
  streamReconnectPolicy: {
    streamOpenReconnectPolicy: { maxAttempts: number };
  };
}

/** Bound failed connection attempts, not quiet active work. A finite idle retry
 * count disables the candidate SDK's active-turn keepalive. Homa's existing
 * request deadline/watchdog owns how long a turn may remain outstanding. */
export function eveMessageReconnectPolicy(maxAttempts: number) {
  return { streamOpenReconnectPolicy: { maxAttempts } };
}
interface Session { readonly state: EveSessionCursor }
type MessageClient<TResponse> = {
  session(cursor?: EveSessionCursor): Session & {
    send(input: MessageInput): Promise<TResponse>;
  };
} | {
  readonly sessions: {
    attach(sessionId: string, cursor: { streamIndex: number }): Session & {
      send(message: string, options: HandleOptions): Promise<TResponse>;
    };
    create(input: HandleOptions & { message: string }): Promise<{
      session: Session;
      response: TResponse;
    }>;
  };
};

/** Send one ordinary message. No resend or fresh-session fallback on failure.
 * Return the actual session so callers read its advanced cursor after consuming
 * the response, rather than persisting the cursor from before the stream. */
export async function sendEveClientMessage<TResponse>(
  client: MessageClient<TResponse>,
  input: MessageInput,
  cursor: EveSessionCursor | undefined,
  reconnectAttempts: number,
): Promise<{ session: Session; response: TResponse }> {
  if (!("sessions" in client)) {
    const session = client.session(cursor);
    return { session, response: await session.send(input) };
  }
  if (cursor?.sessionId !== undefined &&
      (!cursor.sessionId || cursor.sessionId.trim() !== cursor.sessionId)) {
    throw new Error("An existing Eve conversation requires a valid session ID.");
  }
  if (!cursor?.sessionId && cursor?.continuationToken) {
    throw new Error("A legacy continuation requires a session ID before handle migration.");
  }
  const { message, ...context } = input;
  const options: HandleOptions = {
    ...context,
    streamReconnectPolicy: eveMessageReconnectPolicy(reconnectAttempts),
  };
  if (!cursor?.sessionId) return client.sessions.create({ ...options, message });
  const session = client.sessions.attach(cursor.sessionId, { streamIndex: cursor.streamIndex });
  return { session, response: await session.send(message, options) };
}
