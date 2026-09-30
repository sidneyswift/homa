import type { StreamEventHooks, HookDefinition } from "eve/hooks";

import { timingId } from "./chat-timing";
import { timeServer } from "./chat-timing-server";

/** Keep each recorder's cost separate from the model and the durable stream. */
export function timedHookEvents(name: string, events: StreamEventHooks): StreamEventHooks {
  const result: Record<string, unknown> = {};
  for (const [eventName, handler] of Object.entries(events)) {
    if (!handler) continue;
    result[eventName] = (...args: Parameters<NonNullable<StreamEventHooks["*"]>>) => {
      const [event, ctx] = args;
      // Per-delta hooks can be frequent. Span every invocation, but never include its payload.
      return timeServer(`homa.hook.${name}.${eventName}`, () => (handler as NonNullable<StreamEventHooks["*"]>)(event, ctx), {
        sendId: timingId(ctx.session.auth?.current?.attributes.chatTimingId),
        sessionId: ctx.session.id,
        turnId: "data" in event && "turnId" in event.data ? event.data.turnId : undefined,
      });
    };
  }
  return result as StreamEventHooks;
}

export function withTimedHooks<T extends HookDefinition>(name: string, definition: T): T {
  return { ...definition, events: timedHookEvents(name, definition.events ?? {}) };
}
