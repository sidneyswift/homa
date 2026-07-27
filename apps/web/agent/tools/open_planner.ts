import { z } from "zod";

import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  MissingFamilyContextError,
  resolveAgentAccess,
  type CallerAuthAttributes,
} from "../../lib/agent-db";
import { getPlanBoard } from "../../lib/map/store";
import { currentWeekIndex } from "../../lib/plan-week";

/**
 * Opens the week planner as a canvas beside the chat AND returns what is
 * on it, so the same call gives the parent the board and gives Homa
 * eyes. Web chat renders the output as a live planner panel plus a card
 * in the transcript (planner-canvas.tsx); on SMS or email no panel
 * exists, so the returned summary is the whole product and Homa speaks
 * it in words.
 *
 * Read-only: this tool never changes a plan. Edits go through edit_plan,
 * activity check-offs stay with the parent.
 *
 * Tenancy: familyId comes from session auth only; a model-supplied
 * childId is re-verified inside THAT family (getPlanBoard's explicit
 * family predicate), the same wall as every other tool.
 */

const WRONG_CHILD_NOTE =
  "That child id is not in this family. Use a child id from the family context block.";

/** Channels where no chat surface exists to host the panel. */
const NO_PANEL_CHANNELS = new Set(["sms", "email", "dispatch", "agent-job"]);

interface PlanActivitySummary {
  index: number;
  text: string;
  done: boolean;
}

interface PlanSummary {
  subjectId: string;
  subjectName: string;
  weekNumber: number;
  weekFocus: string;
  /** This week's activities with their exact indices: edit_plan
   * addresses activities by these numbers. */
  activities: PlanActivitySummary[];
  doneCount: number;
  totalCount: number;
  retestDue: boolean;
}

function subjectDisplayName(subjectId: string): string {
  if (subjectId === MONTH_PLAN_SUBJECT) return "The month";
  return getMapSubject(subjectId)?.displayName ?? subjectId;
}

export default defineBoundedTool({
  description:
    "Open the family's week planner beside the chat and see what is on it. Use when the parent asks what is planned, wants to see or adjust the week or the month, asks to schedule an existing lesson or curriculum onto the planner, asks how to input things into the planner, or when you are about to edit a plan and need the current activities with their indices. Returns every plan's current week: focus, activities, and check-offs. In web chat this also opens the planner panel next to the conversation; over SMS or email no panel opens, so tell the week in plain words instead. Read-only; make changes with edit_plan.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    childId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Narrow the board to one child. Leave out to open the whole family's week.",
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

    const board = await getPlanBoard(familyId, input.childId ?? null);
    if (!board) {
      return { error: "unknown_child", note: WRONG_CHILD_NOTE };
    }

    const nowMs = Date.now();
    const children = board.children.map((child) => {
      const plans = board.plans
        .filter((plan) => plan.childId === child.id)
        .map((plan): PlanSummary => {
          const weekIdx = currentWeekIndex(plan, nowMs);
          const week = plan.weeks[weekIdx];
          return {
            subjectId: plan.subjectId,
            subjectName: subjectDisplayName(plan.subjectId),
            weekNumber: weekIdx + 1,
            weekFocus: week.focus,
            activities: week.activities.map((text, index) => ({
              index,
              text,
              done: Boolean(plan.progress[`${week.week}.${index}`]),
            })),
            doneCount: plan.done,
            totalCount: plan.total,
            retestDue: new Date(plan.retestAt).getTime() <= nowMs,
          };
        });
      return { childId: child.id, childName: child.name, plans };
    });

    const hasPlans = children.some((child) => child.plans.length > 0);
    const panelOpens = !NO_PANEL_CHANNELS.has(attrs.channel ?? "");
    return {
      opened: true,
      childId: input.childId ?? null,
      childName: input.childId
        ? board.children.find((child) => child.id === input.childId)?.name ?? null
        : null,
      children,
      note: [
        panelOpens
          ? "The planner is now open beside the chat; the parent is looking at it."
          : "No planner panel opens on this channel: share the week in your own words.",
        hasPlans
          ? "Activity indices above are what edit_plan addresses."
          : "No month exists yet. A month is built with one tap in the child's progress report; offer that door, never invent activities here.",
      ].join(" "),
    };
  },
});
