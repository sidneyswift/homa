import { timedHookEvents } from "../../lib/observability/chat-timing-hooks";
import { defineHook } from "eve/hooks";

import {
  recordToolCallRequested,
  recordToolCallResult,
} from "../../lib/observability/agent-trace";
import { usageChannelFromAttributes } from "../../lib/model-usage";

/**
 * The tool-call flight recorder (founder deep view, 2026-07-13): pairs
 * eve's actions.requested and action.result stream events by callId
 * into public.agent_tool_calls, so the founder console can replay what
 * a session called, with what arguments, and what came back. Best
 * effort on the recordModelUsage law: a capture failure never touches
 * the turn; agent-trace.ts swallows its own errors and the handlers
 * here guard the rest.
 *
 * familyId comes from session auth attributes (the channel stamped it),
 * never from model output.
 */
export default defineHook({
  events: timedHookEvents("record-tool-calls", {
    async "actions.requested"(event, ctx) {
      try {
        const attributes = ctx.session.auth.current?.attributes as
          | { familyId?: string; channel?: string }
          | undefined;
        for (const action of event.data.actions) {
          if (action.kind !== "tool-call") continue;
          await recordToolCallRequested({
            familyId: attributes?.familyId ?? null,
            sessionId: ctx.session.id,
            turnId: event.data.turnId ?? null,
            stepIndex: event.data.stepIndex ?? null,
            callId: action.callId,
            channel: usageChannelFromAttributes(attributes),
            tool: action.toolName,
            args: action.input,
          });
        }
      } catch (error) {
        console.error(
          "record-tool-calls hook (requested) failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    },
    async "action.result"(event, ctx) {
      try {
        const result = event.data.result;
        if (result.kind !== "tool-result") return;
        const status =
          event.data.status === "failed"
            ? "failed"
            : event.data.status === "rejected"
              ? "rejected"
              : "completed";
        await recordToolCallResult({
          sessionId: ctx.session.id,
          callId: result.callId,
          status,
          isError: result.isError ?? null,
          result: result.output,
        });
      } catch (error) {
        console.error(
          "record-tool-calls hook (result) failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    },
  }),
});
