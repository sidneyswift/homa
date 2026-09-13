import {
  ClientError,
  type HandleMessageStreamEvent,
} from "eve/client";

import { shouldStartFreshSession } from "./chat-storage";
import { attachEveSessionForReplay, type EveReplayClient } from "./eve-session-replay";

/** A binding newer than this may still belong to a turn running elsewhere. */
export const ACTIVE_WEB_BINDING_MS = 30_000;
const BINDING_RETRY_MS = 5_000;
const BINDING_RESTORE_DEADLINE_MS = 45_000;
const MAX_BINDING_FAILURES = 3;
const AUTHORIZATION_REPLAY_GRACE_MS = 250;

function bindingFailureRetryMs(response: Response): number {
  if (response.status !== 503) return BINDING_RETRY_MS;
  const retryAfter = response.headers.get("retry-after")?.trim();
  if (!retryAfter || !/^\d+$/u.test(retryAfter)) return BINDING_RETRY_MS;
  const seconds = Number(retryAfter);
  if (!Number.isFinite(seconds)) return BINDING_RETRY_MS;
  return Math.min(BINDING_RETRY_MS, Math.max(1_000, seconds * 1_000));
}

export interface WebSessionBindingPayload {
  runtimeSessionId: string;
  lastSeenAtMs: number;
  latestSequence: number | null;
  latestUserMessageAtMs: number | null;
}

export interface LocalWebSessionCursor {
  sessionId: string | undefined;
  continuationToken?: string;
  latestSequence: number | null;
}

interface WebSessionBindingResponse {
  ok: true;
  binding: WebSessionBindingPayload | null;
}

export type WebSessionBindingDecision =
  | { kind: "current" }
  | { kind: "fresh" }
  | { kind: "wait"; delayMs: number }
  | { kind: "resume"; sessionId: string; targetSequence: number };

export interface ReplayedWebSession {
  kind: "replayed" | "parked";
  runtimeSessionId: string;
  events: HandleMessageStreamEvent[];
}

export type WebSessionRestoration =
  | ReplayedWebSession
  | { kind: "current" }
  | { kind: "fresh" }
  | { kind: "unavailable" };

export function latestTurnSequence(
  events: readonly HandleMessageStreamEvent[],
): number | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "turn.started") return event.data.sequence;
  }
  return null;
}

export function replayedMessageTimes(
  events: readonly HandleMessageStreamEvent[],
): Record<string, number> {
  const times: Record<string, number> = {};
  for (const event of events) {
    const at = Date.parse(event.meta?.at ?? "");
    if (Number.isNaN(at)) continue;
    if (event.type === "message.received") {
      times[`${event.data.turnId}:user`] = at;
    } else if (event.type === "message.completed") {
      times[`${event.data.turnId}:assistant`] = at;
    }
  }
  return times;
}

function bindingPayload(value: unknown): WebSessionBindingPayload | null | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const response = value as Partial<WebSessionBindingResponse>;
  if (response.ok !== true) return undefined;
  if (response.binding === null) return null;
  if (typeof response.binding !== "object" || response.binding === null) {
    return undefined;
  }
  const binding = response.binding as Partial<WebSessionBindingPayload>;
  const latestSequence = binding.latestSequence;
  const latestUserMessageAtMs = binding.latestUserMessageAtMs;
  return typeof binding.runtimeSessionId === "string" &&
    binding.runtimeSessionId.length > 0 &&
    typeof binding.lastSeenAtMs === "number" &&
    Number.isFinite(binding.lastSeenAtMs) &&
    (latestSequence === null ||
      (typeof latestSequence === "number" &&
        Number.isInteger(latestSequence) &&
        latestSequence >= 0)) &&
    (latestUserMessageAtMs === null ||
      (typeof latestUserMessageAtMs === "number" &&
        Number.isFinite(latestUserMessageAtMs)))
    ? {
        runtimeSessionId: binding.runtimeSessionId,
        lastSeenAtMs: binding.lastSeenAtMs,
        latestSequence,
        latestUserMessageAtMs,
      }
    : undefined;
}

export function webSessionBindingDecision(input: {
  binding: WebSessionBindingPayload | null;
  current?: LocalWebSessionCursor;
  nowMs: number;
  timeZone: string;
  /** Derived from the client API, never from cached credentials or binding data. */
  usesSessionHandles?: boolean;
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
  const latestSequence = input.binding.latestSequence;
  if (
    latestSequence === null ||
    input.binding.latestUserMessageAtMs === null ||
    input.binding.latestUserMessageAtMs < input.binding.lastSeenAtMs
  ) {
    return { kind: "wait", delayMs: BINDING_RETRY_MS };
  }
  if (
    input.current?.sessionId === input.binding.runtimeSessionId &&
    (input.usesSessionHandles === true ||
      (typeof input.current.continuationToken === "string" &&
        input.current.continuationToken.length > 0)) &&
    input.current.latestSequence === latestSequence
  ) {
    return { kind: "current" };
  }
  const delayMs =
    input.binding.lastSeenAtMs + ACTIVE_WEB_BINDING_MS - input.nowMs;
  if (delayMs > 0) return { kind: "wait", delayMs };
  return {
    kind: "resume",
    sessionId: input.binding.runtimeSessionId,
    targetSequence: latestSequence,
  };
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
  client: EveReplayClient;
  sessionId: string;
  targetSequence: number;
  signal: AbortSignal;
}): Promise<WebSessionRestoration | null> {
  const session = attachEveSessionForReplay(input.client, input.sessionId);
  const events: HandleMessageStreamEvent[] = [];
  let targetTurnSeen = false;
  let targetBoundary: "waiting" | "terminal" | null = null;
  let authorizationPending = false;
  let authorizationTimer: ReturnType<typeof setTimeout> | null = null;
  const replayController = new AbortController();
  const abortReplay = () => replayController.abort();
  input.signal.addEventListener("abort", abortReplay);
  try {
    for await (const event of session.stream({
      startIndex: 0,
      signal: replayController.signal,
    })) {
      events.push(event);
      if (
        event.type === "turn.started" &&
        event.data.sequence === input.targetSequence
      ) {
        targetTurnSeen = true;
      }
      if (targetTurnSeen && event.type === "authorization.required") {
        authorizationPending = true;
        authorizationTimer = setTimeout(
          () => replayController.abort(),
          AUTHORIZATION_REPLAY_GRACE_MS,
        );
      } else if (
        targetTurnSeen &&
        event.type === "authorization.completed"
      ) {
        authorizationPending = false;
        if (authorizationTimer !== null) clearTimeout(authorizationTimer);
        authorizationTimer = null;
      }
      if (
        targetTurnSeen &&
        (event.type === "session.waiting" ||
          event.type === "session.completed" ||
          event.type === "session.failed")
      ) {
        targetBoundary = event.type === "session.waiting" ? "waiting" : "terminal";
        break;
      }
    }
  } catch (error) {
    if (input.signal.aborted) return null;
    if (replayController.signal.aborted && authorizationPending) {
      return { kind: "parked", runtimeSessionId: input.sessionId, events };
    }
    // A binding to a runtime session the durable store no longer has is
    // equivalent to no resumable server session. This exact HTTP status is
    // verification of absence, not a general network fallback.
    if (error instanceof ClientError && error.status === 404) {
      return { kind: "fresh" };
    }
    throw error;
  } finally {
    if (authorizationTimer !== null) clearTimeout(authorizationTimer);
    input.signal.removeEventListener("abort", abortReplay);
  }
  if (input.signal.aborted) return null;
  if (replayController.signal.aborted && authorizationPending) {
    return { kind: "parked", runtimeSessionId: input.sessionId, events };
  }
  const terminal = [...events]
    .reverse()
    .find((event) =>
      event.type === "session.completed" || event.type === "session.failed",
    );
  if (targetTurnSeen && targetBoundary !== null) {
    return { kind: "replayed", runtimeSessionId: input.sessionId, events };
  }
  return terminal ? { kind: "fresh" } : null;
}

/**
 * Resolves the server binding before this tab may send. An exact session and
 * turn sequence can continue immediately. A mismatch waits out the active-turn
 * window and is then read to its durable end, so another tab's in-flight turn
 * settles before this one rotates to a fresh writable session. Replayed event
 * positions are display-only for the legacy protocol because continuation tokens
 * cannot be reconstructed from events. Handle clients can continue an exact
 * verified session/sequence without a token; server ownership checks still apply. Read
 * failures retry within a deadline; they never silently authorize a send.
 */
export async function restoreServerBoundEveSession(input: {
  client: EveReplayClient;
  current?: LocalWebSessionCursor;
  timeZone: string;
  signal: AbortSignal;
  fetcher?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<WebSessionRestoration | null> {
  const fetcher = input.fetcher ?? fetch;
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? abortableSleep;
  let failureCount = 0;

  const deadlineController = new AbortController();
  const deadlineTimer = setTimeout(
    () => deadlineController.abort(),
    BINDING_RESTORE_DEADLINE_MS,
  );
  const stopForParent = () => deadlineController.abort();
  input.signal.addEventListener("abort", stopForParent);

  try {
    while (!deadlineController.signal.aborted) {
      let retryMs = BINDING_RETRY_MS;
      try {
        const response = await fetcher("/api/chat/session-binding", {
          cache: "no-store",
          signal: deadlineController.signal,
        });
        if (!response.ok) {
          retryMs = bindingFailureRetryMs(response);
          throw new Error(`binding read returned ${response.status}`);
        }
        const payload = bindingPayload(await response.json());
        if (payload === undefined) {
          throw new Error("binding read returned an invalid body");
        }
        const decision = webSessionBindingDecision({
          binding: payload,
          current: input.current,
          nowMs: now(),
          timeZone: input.timeZone,
          usesSessionHandles: "sessions" in input.client,
        });
        if (decision.kind === "fresh" || decision.kind === "current") {
          return decision;
        }
        if (decision.kind === "wait") {
          failureCount = 0;
          await sleep(
            Math.min(decision.delayMs, BINDING_RETRY_MS),
            deadlineController.signal,
          );
          continue;
        }
        const restored = await replayBoundSession({
          client: input.client,
          sessionId: decision.sessionId,
          targetSequence: decision.targetSequence,
          signal: deadlineController.signal,
        });
        if (restored) {
          const confirmationResponse = await fetcher(
            "/api/chat/session-binding",
            {
              cache: "no-store",
              signal: deadlineController.signal,
            },
          );
          if (!confirmationResponse.ok) {
            retryMs = bindingFailureRetryMs(confirmationResponse);
            throw new Error(
              `binding confirmation returned ${confirmationResponse.status}`,
            );
          }
          const confirmed = bindingPayload(await confirmationResponse.json());
          if (confirmed === undefined) {
            throw new Error("binding confirmation returned an invalid body");
          }
          if (
            confirmed?.runtimeSessionId === decision.sessionId &&
            confirmed.latestSequence === decision.targetSequence
          ) {
            return restored;
          }
          failureCount = 0;
          continue;
        }
        failureCount += 1;
      } catch {
        if (input.signal.aborted) return null;
        if (deadlineController.signal.aborted) return { kind: "unavailable" };
        failureCount += 1;
      }
      if (failureCount >= MAX_BINDING_FAILURES) return { kind: "unavailable" };
      await sleep(retryMs, deadlineController.signal);
    }
    return input.signal.aborted ? null : { kind: "unavailable" };
  } finally {
    clearTimeout(deadlineTimer);
    input.signal.removeEventListener("abort", stopForParent);
  }
}
