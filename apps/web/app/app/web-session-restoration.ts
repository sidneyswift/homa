import {
  ClientError,
  type Client,
  type HandleMessageStreamEvent,
  type SessionState,
} from "eve/client";

import { shouldStartFreshSession } from "./chat-storage";

/** A binding newer than this may still belong to a turn running elsewhere. */
export const ACTIVE_WEB_BINDING_MS = 30_000;
const BINDING_RETRY_MS = 5_000;

export interface WebSessionBindingPayload {
  runtimeSessionId: string;
  lastSeenAtMs: number;
}

interface WebSessionBindingResponse {
  ok: true;
  binding: WebSessionBindingPayload | null;
}

export type WebSessionBindingDecision =
  | { kind: "fresh" }
  | { kind: "wait"; delayMs: number }
  | { kind: "resume"; sessionId: string };

export interface RestoredWebSession {
  kind: "resumed";
  events: HandleMessageStreamEvent[];
  session: SessionState;
}

export type WebSessionRestoration = RestoredWebSession | { kind: "fresh" };

function bindingPayload(value: unknown): WebSessionBindingPayload | null | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const response = value as Partial<WebSessionBindingResponse>;
  if (response.ok !== true) return undefined;
  if (response.binding === null) return null;
  if (typeof response.binding !== "object" || response.binding === null) {
    return undefined;
  }
  const binding = response.binding as Partial<WebSessionBindingPayload>;
  return typeof binding.runtimeSessionId === "string" &&
    binding.runtimeSessionId.length > 0 &&
    typeof binding.lastSeenAtMs === "number" &&
    Number.isFinite(binding.lastSeenAtMs)
    ? {
        runtimeSessionId: binding.runtimeSessionId,
        lastSeenAtMs: binding.lastSeenAtMs,
      }
    : undefined;
}

export function webSessionBindingDecision(input: {
  binding: WebSessionBindingPayload | null;
  nowMs: number;
  timeZone: string;
}): WebSessionBindingDecision {
  if (
    input.binding === null ||
    shouldStartFreshSession(
      input.binding.lastSeenAtMs,
      input.nowMs,
      input.timeZone,
    )
  ) {
    return { kind: "fresh" };
  }
  const delayMs =
    input.binding.lastSeenAtMs + ACTIVE_WEB_BINDING_MS - input.nowMs;
  return delayMs > 0
    ? { kind: "wait", delayMs }
    : { kind: "resume", sessionId: input.binding.runtimeSessionId };
}

async function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done);
  });
}

async function replayBoundSession(input: {
  client: Pick<Client, "session">;
  sessionId: string;
  signal: AbortSignal;
}): Promise<WebSessionRestoration | null> {
  const session = input.client.session({
    sessionId: input.sessionId,
    streamIndex: 0,
  });
  const events: HandleMessageStreamEvent[] = [];
  try {
    for await (const event of session.stream({
      startIndex: 0,
      signal: input.signal,
    })) {
      events.push(event);
    }
  } catch (error) {
    if (input.signal.aborted) return null;
    // A binding to a runtime session the durable store no longer has is
    // equivalent to no resumable server session. This exact HTTP status is
    // verification of absence, not a general network fallback.
    if (error instanceof ClientError && error.status === 404) {
      return { kind: "fresh" };
    }
    throw error;
  }
  if (input.signal.aborted) return null;
  if (session.state.sessionId === input.sessionId) {
    return { kind: "resumed", events, session: session.state };
  }
  const terminal = [...events]
    .reverse()
    .find((event) =>
      event.type === "session.completed" || event.type === "session.failed",
    );
  return terminal ? { kind: "fresh" } : null;
}

/**
 * Resolves the server binding before this tab may send. A fresh binding waits
 * out the active-turn window and is then read to its durable end, so another
 * tab's in-flight turn settles before this one adopts the exact stream index.
 * Read failures retry; they never silently authorize a fresh session.
 */
export async function restoreServerBoundEveSession(input: {
  client: Pick<Client, "session">;
  timeZone: string;
  signal: AbortSignal;
  fetcher?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<WebSessionRestoration | null> {
  const fetcher = input.fetcher ?? fetch;
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? abortableSleep;

  while (!input.signal.aborted) {
    try {
      const response = await fetcher("/api/chat/session-binding", {
        cache: "no-store",
        signal: input.signal,
      });
      if (!response.ok) throw new Error(`binding read returned ${response.status}`);
      const payload = bindingPayload(await response.json());
      if (payload === undefined) throw new Error("binding read returned an invalid body");
      const decision = webSessionBindingDecision({
        binding: payload,
        nowMs: now(),
        timeZone: input.timeZone,
      });
      if (decision.kind === "fresh") return decision;
      if (decision.kind === "wait") {
        await sleep(Math.min(decision.delayMs, BINDING_RETRY_MS), input.signal);
        continue;
      }
      const restored = await replayBoundSession({
        client: input.client,
        sessionId: decision.sessionId,
        signal: input.signal,
      });
      if (restored) return restored;
    } catch {
      if (input.signal.aborted) return null;
    }
    await sleep(BINDING_RETRY_MS, input.signal);
  }
  return null;
}
