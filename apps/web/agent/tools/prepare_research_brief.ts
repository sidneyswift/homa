import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  prepareResearchBrief,
  type PrepareResearchBriefResult,
} from "../../lib/tasks/research-brief-preparation";
import { usesResearchBriefV2Delivery } from "../../lib/tasks/delivery-version";

export interface DispatchResearchBriefAuth {
  channel?: string;
  familyId?: string;
  taskRunId?: string;
  taskKind?: string;
  deliveryVersion?: string;
}

interface EnabledMorningResearchBriefDispatch
  extends DispatchResearchBriefAuth {
  channel: "dispatch";
  familyId: string;
  taskRunId: string;
  taskKind: "morning_brief";
  deliveryVersion: "research_brief_v2";
}

export function isEnabledMorningResearchBriefDispatch(
  attributes: DispatchResearchBriefAuth,
): attributes is EnabledMorningResearchBriefDispatch {
  return (
    attributes.channel === "dispatch" &&
    attributes.taskKind === "morning_brief" &&
    attributes.deliveryVersion === "research_brief_v2" &&
    usesResearchBriefV2Delivery(attributes.deliveryVersion) &&
    Boolean(attributes.familyId) &&
    Boolean(attributes.taskRunId)
  );
}

/** A dispatch run of any kind with a stamped family and run id. The
 * session is real; this tool may still not apply to it. */
export function isAuthenticatedDispatchTaskRun(
  attributes: DispatchResearchBriefAuth,
): boolean {
  return (
    attributes.channel === "dispatch" &&
    Boolean(attributes.familyId) &&
    Boolean(attributes.taskRunId)
  );
}

/** A real dispatch run that does not use the prepared v2 pipeline: a
 * parent-created task, a journal prompt, or a legacy built-in brief. The
 * errors text carries the model's next step instead of a dead end,
 * because the only compliant exit from a dead end on a verbatim-delivery
 * channel is narrating it to the family (2026-07-18 Gomes incident). */
export function prepareResearchBriefComposeDirectlyRedirect(): PrepareResearchBriefResult {
  return {
    ok: false,
    retryable: false,
    category: "not_applicable",
    errors: [
      "This run does not use the prepared v2 morning brief pipeline, so this tool does not apply and nothing was staged. Compose the reply yourself, directly from the instructions and any research context in this dispatch message, keeping whatever format the message asks for, and do not call this tool again. Never mention tools, dispatch runs, or internal state in the reply.",
    ],
  };
}

export function prepareResearchBriefDispatchFailure(): PrepareResearchBriefResult {
  return {
    ok: false,
    retryable: false,
    category: "dispatch_unavailable",
    errors: [
      "prepare_research_brief requires enabled v2 and an authenticated morning dispatch run",
    ],
  };
}

export default defineBoundedTool({
  description:
    "Validate and stage one morning research brief for delivery. Applies only to the built-in v2 morning brief dispatch, never to a task a family set up themselves. Use only after choosing the single child and eligible cited source supplied in this dispatch run. A failed result says whether revision is retryable; terminal failures must stop and follow the result's note.",
  deadlineMs: TOOL_DEADLINE.quick,
  inputSchema: z.object({
    knowledgeId: z.string().uuid(),
    childId: z.string().uuid(),
    observationId: z.string().uuid().optional(),
    draft: z.string().min(1).max(10_000),
  }),
  async execute(input, ctx) {
    const attributes = (ctx.session.auth.current?.attributes ?? {}) as DispatchResearchBriefAuth;
    if (!isEnabledMorningResearchBriefDispatch(attributes)) {
      return isAuthenticatedDispatchTaskRun(attributes)
        ? prepareResearchBriefComposeDirectlyRedirect()
        : prepareResearchBriefDispatchFailure();
    }
    return await prepareResearchBrief({
      familyId: attributes.familyId,
      taskRunId: attributes.taskRunId,
      deliveryVersion: attributes.deliveryVersion,
      knowledgeId: input.knowledgeId,
      childId: input.childId,
      observationId: input.observationId,
      draft: input.draft,
    });
  },
});
