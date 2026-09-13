"use client";

import {
  EveAgentStore,
  defaultMessageReducer,
  type ClientOptions,
  type EveAgentStoreCallbacks,
  type EveMessageData,
  type HandleMessageStreamEvent,
} from "eve/client";
import { useMemo, useState, useSyncExternalStore } from "react";

import type { ChatSessionCursor } from "./chat-session-cursor";
import { createRecoverableEveAgentStore } from "./recoverable-eve-agent-store";

interface RecoverableChatAgentOptions extends EveAgentStoreCallbacks<EveMessageData> {
  connection: Pick<ClientOptions, "host" | "auth" | "headers">;
  reconnectAttempts: number;
  usesSessionHandles: boolean;
  initialSession?: ChatSessionCursor;
  initialEvents?: readonly HandleMessageStreamEvent[];
}

/** Retains React's subscription while a verified recovered session is adopted. */
export function useRecoverableChatAgent(options: RecoverableChatAgentOptions) {
  const [agent] = useState(() => {
    const createStore = (
      cursor?: ChatSessionCursor,
      events: readonly HandleMessageStreamEvent[] = [],
    ) => new EveAgentStore({
      ...options.connection,
      ...{ maxReconnectAttempts: options.reconnectAttempts },
      initialSession: cursor?.sessionId
        ? { ...cursor, sessionId: cursor.sessionId }
        : undefined,
      initialEvents: events,
      reducer: defaultMessageReducer(),
    });
    const controller = createRecoverableEveAgentStore(
      createStore(options.initialSession, options.initialEvents),
    );
    const reconnect = options.usesSessionHandles ? {
      streamReconnectPolicy: {
        streamOpenReconnectPolicy: { maxAttempts: options.reconnectAttempts },
        streamIdleReconnectPolicy: { maxAttempts: options.reconnectAttempts },
      },
    } : {};
    return {
      ...controller,
      readSnapshot: () => controller.snapshot,
      currentSession: (): ChatSessionCursor => controller.snapshot.session ?? { streamIndex: 0 },
      adopt: (cursor: ChatSessionCursor, events?: readonly HandleMessageStreamEvent[]) => controller.replace(createStore(cursor, events)),
      reset: () => controller.replace(createStore()),
      send: (input: Parameters<typeof controller.send>[0]) => controller.send({ ...input, ...reconnect }),
    };
  });
  agent.setCallbacks(options);
  const snapshot = useSyncExternalStore(agent.subscribe, agent.readSnapshot, agent.readSnapshot);
  return useMemo(() => {
    const session: ChatSessionCursor = snapshot.session ?? { streamIndex: 0 };
    return {
      ...snapshot,
      session,
      adopt: agent.adopt,
      currentSession: agent.currentSession,
      reset: agent.reset,
      send: agent.send,
      stop: agent.stop,
    };
  }, [agent, snapshot]);
}
