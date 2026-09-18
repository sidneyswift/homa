import { withTimedHooks } from "../../lib/observability/chat-timing-hooks";
import { defineHook } from "eve/hooks";

import { modelRouterState } from "../model-router-state";
import { ROUTER_MODEL } from "../../lib/model-router/router";
import {
  recordModelUsage,
  modelUsageChannelFromAttributes,
  usageSurfaceFromAttributes,
} from "../../lib/model-usage";

/**
 * The chat side of the consumption ledger (MS-6): every completed model
 * call in an agent turn carries usage on eve's step.completed event, and
 * this hook lands it in public.model_usage with the family and channel
 * from session auth, never from model output. Covers web chat, SMS,
 * email, dispatch, and the subject lesson lane because they are all
 * channels on the one agent.
 *
 * The model id comes from session-scoped routing state for the completed call. Compaction summary
 * calls are not separately recorded (compaction.completed carries no
 * usage; the trigger event's usageInputTokens measures context size, not
 * spend), a known small gap noted in the plan.
 *
 * Failure posture: hooks that throw fail the TURN, so recording is
 * wrapped and best-effort; a lost telemetry row never breaks a
 * conversation. Sessions with no family (unlinked SMS, dev probes)
 * record with family_id null so fleet spend still adds up.
 */
export default defineHook(withTimedHooks("record-usage", {
  events: {
    async "step.completed"(event, ctx) {
      try {
        const usage = event.data.usage;
        if (!usage) return;
        const attributes = ctx.session.auth.current?.attributes as
          | {
              channel?: string;
              familyId?: string;
              taskKind?: string;
              taskRunId?: string;
              deliveryVersion?: string;
            }
          | undefined;
        const route = modelRouterState.get();
        await recordModelUsage({
          familyId: attributes?.familyId ?? null,
          surface: usageSurfaceFromAttributes(attributes),
          channel: modelUsageChannelFromAttributes(attributes),
          model: route.model,
          modality: "text",
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          sessionId: ctx.session.id,
          turnId: event.data.turnId,
        });
        if (route.inputTokens !== undefined) {
          await recordModelUsage({
            familyId: attributes?.familyId ?? null,
            surface: usageSurfaceFromAttributes(attributes),
            channel: modelUsageChannelFromAttributes(attributes),
            model: ROUTER_MODEL,
            modality: "text",
            inputTokens: route.inputTokens,
            outputTokens: route.outputTokens,
            sessionId: ctx.session.id,
            turnId: event.data.turnId,
          });
        }
      } catch (error) {
        console.error(
          "record-usage hook failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    },
  },
}));
