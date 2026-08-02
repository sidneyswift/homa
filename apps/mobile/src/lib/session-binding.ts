import {
  ClientError,
  type Client,
  type HandleMessageStreamEvent,
  type SessionState,
} from "eve/client";

import { shouldStartFreshSession } from "./chat-storage";
import { EVE_CHANNEL_HEADER } from "./env";

/** A binding newer than this may still belong to a turn running elsewhere. */
export const ACTIVE_MOBILE_BINDING_MS = 30_000;
const BINDING_RETRY_MS = 5_000;

export interface MobileSessionBindingPayload {
  runtimeSessionId: string;
  lastSeenAtMs: number;
}

interface MobileSessionBindingResponse {
  ok: true;
  binding: MobileSessionBindingPayload | null;
}

export type MobileSessionBindingDecision =
  | { kind: "fresh" }
  | { kind: "wait"; delayMs: number }
  | { kind: "resume"; sessionId: string };

export type MobileSessionRestoration =
  | {
      kind: "resumed";
      events: HandleMessageStreamEvent[];
      session: SessionState;
    }
  | { kind: "fresh" };

function bindingPayload(
  value: unknown,
): MobileSessionBindingPayload | null | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const response = value as Partial<MobileSessionBindingResponse>;
  if (response.ok !== true) return undefined;
  if (response.binding === null) return null;
  if (typeof response.binding !== "object" || response.binding === null) {
    return undefined;
  }
  const binding = response.binding as Partial<MobileSessionBindingPayload>;
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

export function mobileSessionBindingDecision(input: {
  binding: MobileSessionBindingPayload | null;
  nowMs: number;
  timeZone: string | null | undefined;
}): MobileSessionBindingDecision {
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
    input.binding.lastSeenAtMs + ACTIVE_MOBILE_BINDING_MS - input.nowMs;
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
}): Promise<MobileSessionRestoration | null> {
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
 * Resolves the shared server binding before mobile may send. Failed reads
 * retry instead of silently authorizing a new session and forking chat.
 */
export async function restoreServerBoundMobileSession(input: {
  client: Pick<Client, "session">;
  apiOrigin: string;
  bearer: () => Promise<string>;
  timeZone: string | null | undefined;
  signal: AbortSignal;
  fetcher?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<MobileSessionRestoration | null> {
  const fetcher = input.fetcher ?? fetch;
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? abortableSleep;
  const origin = input.apiOrigin.replace(/\/+$/, "");

  while (!input.signal.aborted) {
    try {
      const accessToken = await input.bearer();
      const response = await fetcher(`${origin}/api/chat/session-binding`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          ...EVE_CHANNEL_HEADER,
        },
        signal: input.signal,
      });
      if (!response.ok) {
        throw new Error(`binding read returned ${response.status}`);
      }
      const payload = bindingPayload(await response.json());
      if (payload === undefined) {
        throw new Error("binding read returned an invalid body");
      }
      const decision = mobileSessionBindingDecision({
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
