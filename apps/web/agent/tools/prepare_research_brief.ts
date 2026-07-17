import { defineTool } from "eve/tools";
import { z } from "zod";

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

export default defineTool({
  description:
    "Validate and stage one morning research brief for delivery. Use only after choosing the single child and eligible cited source supplied in this dispatch run. A failed result says whether revision is retryable; terminal failures must stop.",
  inputSchema: z.object({
    knowledgeId: z.string().uuid(),
    childId: z.string().uuid(),
    observationId: z.string().uuid().optional(),
    draft: z.string().min(1).max(10_000),
  }),
  async execute(input, ctx) {
    const attributes = (ctx.session.auth.current?.attributes ?? {}) as DispatchResearchBriefAuth;
    if (!isEnabledMorningResearchBriefDispatch(attributes)) {
      return prepareResearchBriefDispatchFailure();
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
