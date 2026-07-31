import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useEveAgent, type EveMessage } from "eve/react";

import { foldEventsToMessages } from "../../lib/chat-storage";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import { recoverLostTurn } from "../../lib/turn-recovery";
import { isSendLineOccupied } from "../chat/chat-send-policy";
import {
  buildEveTransport,
  RECOVERY_DEADLINE_MS,
  VISIBLE_STALL_MS,
  WAKE_GRACE_MS,
  WATCHDOG_STALL_MS,
} from "../chat/chat-session";
import { busyLabel } from "../chat/message-utils";

/**
 * The voice screen's eve session: the same authenticated streaming
 * channel, watchdogs, and lost-turn recovery as chat (chat-session.tsx
 * is the source of truth for that pattern; the transport config and
 * stall constants are imported from it, never re-declared), minus the
 * transcript machinery. A voice session is ephemeral by design in this
 * phase: it starts fresh on mount, is never folded into the chat
 * transcript, and persists nothing locally. The durable record still
 * exists server-side (conversation_messages), so nothing is lost, and
 * Homa's per-family context is injected server-side on every turn, so
 * a brand-new session already knows the family.
 */

export interface VoiceSession {
  /** The live eve messages, for overlay-signal derivation upstream. */
  messages: readonly EveMessage[];
  /** A turn is running, or lost-turn recovery is still deciding. */
  turnActive: boolean;
  /** Assistant text is visibly streaming right now (speaking). */
  assistantTextStreaming: boolean;
  /** What Homa is doing, for the thinking status line ("putting the
   *  page together...", "reconnecting..."), or null when idle. */
  busyDetail: string | null;
  /** The newest non-empty user utterance, for the ribbon. */
  lastUserText: string | null;
  /** The newest non-empty assistant reply, live-updating as it streams. */
  lastAssistantText: string | null;
  /** The last send failed and recovery gave up; retry() resends it. */
  failed: boolean;
  /** Lost-turn recovery is replaying the durable session server-side. */
  recovering: boolean;
  send: (text: string) => void;
  retry: () => void;
}

function messageText(message: EveMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter((text) => text.length > 0)
    .join("\n")
    .trim();
}

function lastTextByRole(
  messages: readonly EveMessage[],
  role: "user" | "assistant",
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== role) continue;
    const text = messageText(message);
    if (text.length > 0) return text;
  }
  return null;
}

export function useVoiceSession(): VoiceSession {
  /** Last moment the stream showed signs of life (0 = none yet). */
  const lastStreamActivityRef = useRef(0);
  /** Durable event cursor for lost-turn recovery (fresh session = 0). */
  const durableCursorRef = useRef(0);
  const lastSendRef = useRef<{ text: string; atMs: number } | null>(null);
  const recoveryRef = useRef<AbortController | null>(null);
  const reportedErrorRef = useRef<Error | null>(null);
  const [recovering, setRecovering] = useState(false);
  /** After a successful recovery the store restarts clean; the ribbon
   *  keeps the recovered conversation's tail from here instead. */
  const [recoveredTail, setRecoveredTail] = useState<{
    userText: string | null;
    assistantText: string | null;
  } | null>(null);
  /** Messages sent while the line was occupied; flushed as one turn. */
  const queuedRef = useRef<string[]>([]);
  const sendRef = useRef<((input: { message: string }) => Promise<void>) | null>(
    null,
  );

  const flushQueued = useCallback(() => {
    if (queuedRef.current.length === 0) return;
    const message = queuedRef.current.join("\n\n");
    queuedRef.current = [];
    // Next tick: this can run inside the previous send's own teardown,
    // and eve rejects overlapping sends (same move as chat-session).
    setTimeout(() => {
      lastSendRef.current = { text: message, atMs: Date.now() };
      void sendRef.current?.({ message });
    }, 0);
  }, []);

  const agent = useEveAgent({
    ...buildEveTransport(),
    onEvent() {
      lastStreamActivityRef.current = Date.now();
      durableCursorRef.current += 1;
    },
    onFinish(snapshot) {
      // Nothing is persisted here on purpose (ephemeral session, see
      // the module header). A failed turn holds the queue; her next
      // manual send carries it, same as chat.
      if (!snapshot.error) flushQueued();
    },
  });
  const agentError = agent.error;
  const agentReset = agent.reset;
  const agentSend = agent.send;
  const agentStop = agent.stop;

  useEffect(() => {
    sendRef.current = agentSend;
  }, [agentSend]);

  const busy = agent.status === "submitted" || agent.status === "streaming";
  const messages = agent.data.messages;

  // Lost-turn recovery: the durable run usually outlives a dead stream,
  // so before settling on the retry affordance, replay the session
  // server-side and keep the finished reply for the ribbon. The shape
  // mirrors chat-session.tsx (the source of truth); only the fold
  // target differs, a ribbon tail instead of the archived transcript.
  useEffect(() => {
    if (!agentError || agentError === reportedErrorRef.current) return;
    reportedErrorRef.current = agentError;
    const lastSend = lastSendRef.current;
    if (!lastSend || recoveryRef.current) return;
    const controller = new AbortController();
    recoveryRef.current = controller;
    const deadline = setTimeout(() => controller.abort(), RECOVERY_DEADLINE_MS);
    setRecovering(true);
    void (async () => {
      const recovered = await recoverLostTurn({
        supabase,
        sentText: lastSend.text,
        sentAtMs: lastSend.atMs,
        minBoundaryIndex: durableCursorRef.current,
        host: env.apiUrl,
        bearer: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? "";
        },
        signal: controller.signal,
      });
      clearTimeout(deadline);
      if (recoveryRef.current === controller) recoveryRef.current = null;
      if (!controller.signal.aborted && recovered) {
        // The reply exists after all: keep its tail for the ribbon and
        // start the store clean (fresh session, same family context).
        const recoveredMessages = foldEventsToMessages(recovered.events);
        setRecoveredTail({
          userText: lastTextByRole(recoveredMessages, "user"),
          assistantText: lastTextByRole(recoveredMessages, "assistant"),
        });
        agentReset();
        durableCursorRef.current = 0;
        lastSendRef.current = null;
      }
      setRecovering(false);
      // Whichever way it resolved, the line is free again: deliver
      // anything she said while it was undecided.
      flushQueued();
    })();
  }, [agentError, agentReset, flushQueued]);

  // Give up a running recovery when the screen unmounts.
  useEffect(() => {
    return () => recoveryRef.current?.abort();
  }, []);

  // Dead-stream watchdogs, same constants as chat-session.tsx: a
  // backgrounded phone kills the stream, and a half-open connection can
  // hang without erroring. stop() flips status back to ready; the
  // durable turn continues server-side.
  useEffect(() => {
    if (!busy) return;
    lastStreamActivityRef.current = Date.now();
    let wakeGraceTimer: ReturnType<typeof setTimeout> | null = null;
    const isStale = (stallMs: number) =>
      Date.now() - lastStreamActivityRef.current > stallMs;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (!isStale(VISIBLE_STALL_MS) || wakeGraceTimer !== null) return;
      wakeGraceTimer = setTimeout(() => {
        wakeGraceTimer = null;
        // Still nothing after the grace: the stream really is dead.
        if (isStale(VISIBLE_STALL_MS)) agentStop();
      }, WAKE_GRACE_MS);
    });
    const watchdog = setInterval(() => {
      if (isStale(WATCHDOG_STALL_MS)) agentStop();
    }, 15_000);
    return () => {
      subscription.remove();
      clearInterval(watchdog);
      if (wakeGraceTimer !== null) clearTimeout(wakeGraceTimer);
    };
  }, [agentStop, busy]);

  function send(text: string) {
    const message = text.trim();
    if (message.length === 0) return;
    // Occupied by an active stream OR by recovery still deciding: queue
    // instead of forking a second eve session (GH #170's lesson, via
    // chat-send-policy.ts).
    if (isSendLineOccupied({ busy, recovering })) {
      queuedRef.current = [...queuedRef.current, message];
      return;
    }
    recoveryRef.current?.abort();
    if (!agent.session?.sessionId) durableCursorRef.current = 0;
    const outgoing = [...queuedRef.current, message].join("\n\n");
    queuedRef.current = [];
    lastSendRef.current = { text: outgoing, atMs: Date.now() };
    void agent.send({ message: outgoing });
  }

  function retry() {
    const lastSend = lastSendRef.current;
    if (!lastSend) return;
    send(lastSend.text);
  }

  const last = messages.at(-1);
  const rawBusyLabel = busy ? busyLabel(messages) : null;
  const assistantTextStreaming =
    busy &&
    last !== undefined &&
    last.role === "assistant" &&
    rawBusyLabel === null &&
    messageText(last).length > 0;
  const busyDetail = recovering
    ? "reconnecting…"
    : rawBusyLabel === "thinking…"
      ? "thinking about that"
      : rawBusyLabel;

  return {
    messages,
    turnActive: busy || recovering,
    assistantTextStreaming,
    busyDetail,
    lastUserText:
      lastTextByRole(messages, "user") ?? recoveredTail?.userText ?? null,
    lastAssistantText:
      lastTextByRole(messages, "assistant") ??
      recoveredTail?.assistantText ??
      null,
    failed: Boolean(agentError) && !recovering,
    recovering,
    send,
    retry,
  };
}
