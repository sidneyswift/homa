import { defineHook } from "eve/hooks";

import { HOMA_MODEL } from "../model";
import {
  recordModelUsage,
  usageChannelFromAttributes,
  usageSurfaceFromAttributes,
} from "../../lib/model-usage";

/**
 * The chat side of the consumption ledger (MS-6): every completed model
 * call in an agent turn carries usage on eve's step.completed event, and
 * this hook lands it in public.model_usage with the family and channel
 * from session auth, never from model output. Covers web chat, SMS,
 * email, and dispatch automatically because they are all channels on the
 * one agent.
 *
 * The model id is the agent's pinned HOMA_MODEL: step.completed does not
 * carry a model id, and the agent runs exactly one. Compaction summary
 * calls are not separately recorded (compaction.completed carries no
 * usage; the trigger event's usageInputTokens measures context size, not
 * spend), a known small gap noted in the plan.
 *
 * Failure posture: hooks that throw fail the TURN, so recording is
 * wrapped and best-effort; a lost telemetry row never breaks a
 * conversation. Sessions with no family (unlinked SMS, dev probes)
 * record with family_id null so fleet spend still adds up.
 */
export default defineHook({
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
        await recordModelUsage({
          familyId: attributes?.familyId ?? null,
          surface: usageSurfaceFromAttributes(attributes),
          channel: usageChannelFromAttributes(attributes),
          model: HOMA_MODEL,
          modality: "text",
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          sessionId: ctx.session.id,
          turnId: event.data.turnId,
        });
      } catch (error) {
        console.error(
          "record-usage hook failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    },
  },
});
