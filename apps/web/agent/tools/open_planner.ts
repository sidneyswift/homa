import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  MissingFamilyContextError,
  resolveAgentAccess,
  type CallerAuthAttributes,
} from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import { siteUrl } from "../../lib/map/email";
import { getPlanBoard } from "../../lib/map/store";
import { plannerEventClient } from "../../lib/planner-events";
import { shapePlannerPlan } from "../../lib/planner-payload";
import { listPlannerLearningActivitiesPinned } from "../../lib/planner-learning-activities";
import {
  listScheduledDatesPinned,
  scheduledDatesByActivity,
} from "../../lib/plan-schedule";
import { addDaysDateOnly } from "../../lib/unified-planner";

/**
 * Reads the week planner and supplies a card in typed chat. The parent
 * taps the card to open the board; reads used before edits do not take
 * over the conversation (issue #1216). Live voice may show the board.
 * On SMS or email the returned summary is the whole product.
 *
 * The payload is model grounding, bounded on purpose (issue #257, arc
 * PR B0; lib/planner-payload.ts owns the rule): a childId-narrowed call
 * returns that child's plans with ALL FOUR weeks, each activity carrying
 * its real scheduledDate from plan_activity_schedule; a family-wide call
 * returns each plan's current week plus per-week summaries. Before this,
 * no tool read plan_activity_schedule at all, so the reshuffle procedure
 * was unexecutable as written.
 *
 * Read-only: this tool never changes a plan. Edits go through edit_plan,
 * and exact completions go through complete_planner_activity.
 *
 * Tenancy: familyId comes from session auth only; a model-supplied
 * childId is re-verified inside THAT family (getPlanBoard's explicit
 * family predicate), the same wall as every other tool. The schedule
 * read carries its own explicit family predicate too.
 */

const WRONG_CHILD_NOTE =
  "That child id is not in this family. Use a child id from the family context block.";

/** Channels where no chat surface exists to host the panel. */
const NO_PANEL_CHANNELS = new Set(["sms", "email", "dispatch", "agent-job"]);

export default defineBoundedTool({
  description:
    "Read the family's Planner and see both planned and completed learning. Use when the parent asks what is planned or logged, wants to see or adjust the week or month, asks to schedule an existing lesson or curriculum, asks how to input things, or when you are about to edit, schedule, or complete an existing item. Pass childId to get that child's plans with all four weeks in full; without it every plan returns the current week plus summaries. Each generated activity includes its exact text, index, scheduledDate, and planRevision for stale-safe edits, schedules, and completions. learningActivities are stable independent rows with ids, dates, status, childIds, and optional duration. Typed chat shows a Planner card that the parent can tap to open; live voice may show the board. Over SMS or email tell it in plain words. Read-only; use the exact Planner tools to make changes.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    childId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Narrow the board to one child and get their plans' full four weeks with dates. Leave out to open the whole family's week (current weeks plus summaries).",
      ),
  }),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { error: "no_family", note: error.message };
      }
      throw error;
    }
    const attrs = (attributes ?? {}) as CallerAuthAttributes & { channel?: string };

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const [board, scheduleRows, learningActivities] = await Promise.all([
      getPlanBoard(familyId, input.childId ?? null),
      listScheduledDatesPinned(familyId, input.childId ?? null),
      listPlannerLearningActivitiesPinned({
        familyId,
        fromDate: addDaysDateOnly(today, -14),
        toDate: addDaysDateOnly(today, 42),
        childId: input.childId ?? null,
      }),
    ]);
    if (!board) {
      return { error: "unknown_child", note: WRONG_CHILD_NOTE };
    }
    const scheduledDates = scheduledDatesByActivity(scheduleRows);

    const nowMs = now.getTime();
    const fullWeeks = Boolean(input.childId);
    const children = board.children.map((child) => ({
      childId: child.id,
      childName: child.name,
      plans: board.plans
        .filter((plan) => plan.childId === child.id)
        .map((plan) =>
          shapePlannerPlan(plan, {
            nowMs,
            fullWeeks,
            scheduledDates,
            siteRoot: siteUrl(),
          }),
        ),
    }));

    await emitMapEvent("planner.viewed", {
      family_id: familyId,
      ...(input.childId ? { child_id: input.childId } : {}),
      surface: "chat",
      client: plannerEventClient(attrs.channel),
    });

    const hasPlans = children.some((child) => child.plans.length > 0);
    // A provisional week is derived from the child's age and has no row
    // behind it, so it is real to look at and impossible to write to.
    const hasProvisional = children.some((child) =>
      child.plans.some((plan) => plan.provisional),
    );
    const hasStored = children.some((child) =>
      child.plans.some((plan) => !plan.provisional),
    );
    const hasPlannerSurface = !NO_PANEL_CHANNELS.has(attrs.channel ?? "");
    return {
      opened: true,
      childId: input.childId ?? null,
      childName: input.childId
        ? board.children.find((child) => child.id === input.childId)?.name ?? null
        : null,
      children,
      learningActivities: learningActivities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        subject: activity.subject,
        activityDate: activity.activityDate,
        status: activity.status,
        childIds: activity.childIds,
        durationMinutes: activity.durationMinutes,
      })),
      note: [
        hasPlannerSurface
          ? "Typed chat shows a planner card the parent can tap to open; it does not automatically open the board or leave the conversation. Live voice may show the board. Confirm the requested result briefly and point to the card when useful. If the parent cannot see it, tell the week in plain words."
          : "No planner panel opens on this channel: share the week in your own words.",
        hasStored
          ? [
              "Activity indices above are what edit_plan and schedule_plan_activity address. Copy the planRevision and exact activity text into a write; they prove the slot is still the one the parent saw.",
              "Use complete_planner_activity with the exact planRevision, indices, and text to mark generated work finished. Stable learningActivities use their id.",
              "scheduledDate is the activity's real calendar date; null means the parent has not put it on a day.",
              fullWeeks
                ? ""
                : "Only each plan's current week is shown in full; call again with childId for a child's full four weeks.",
            ]
              .filter(Boolean)
              .join(" ")
          : "",
        hasProvisional
          ? "A plan marked provisional is NOT this child's plan. It is the month a typical child of their age gets, built from their birthday alone because they have no answers yet, and it is not saved. Say that plainly in your own words, as a starting point rather than as something you made for them, and never as built from what she told you. Do not edit or schedule a provisional week: there is no row behind it and both tools will fail. Her answers replace it with the real month, which is the honest reason to offer the questions."
          : "",
        hasPlans
          ? ""
          : "No month exists and none could be derived. A month is built with one tap in the child's progress report; offer that door, never invent activities here.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  },
});
