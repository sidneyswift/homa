import { resolveApiFamily } from "../../../../../lib/api-auth";
import { emitMapEvent } from "../../../../../lib/map/events";
import { createPlanActivityCheckHandler } from "../../../../../lib/map/plan-check-route";
import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";

/**
 * Atomic authenticated Planner check-off. The caller supplies the plan
 * meaning it saw, while the authenticated Supabase client supplies the
 * user identity. PostgreSQL re-scopes the child and validates meaning
 * under the same row lock as the single-key mutation.
 */

export const POST = createPlanActivityCheckHandler({
  isRateLimited: (request) =>
    rateLimited(`plan-check:${clientIp(request)}`, 120),
  authorize: async (request) => {
    const auth = await resolveApiFamily(request);
    if (!auth) return null;
    return {
      execute: async (input) =>
        await auth.supabase.rpc("set_plan_activity_check_v2", {
          target_child_id: input.childId,
          target_subject_id: input.subjectId,
          target_check_key: input.checkKey,
          target_done: input.done,
          target_expected_text: input.expectedText,
          target_plan_revision: input.planRevision,
        }),
    };
  },
  emitProgress: async ({ familyId, childId, subjectId, doneCount }) => {
    await emitMapEvent("map.plan_progress", {
      family_id: familyId,
      child_id: childId,
      subject: subjectId,
      done_count: doneCount,
    });
  },
});
