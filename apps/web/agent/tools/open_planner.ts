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
import {
  listScheduledDatesPinned,
  scheduledDatesByActivity,
} from "../../lib/plan-schedule";

/**
 * Opens the week planner as a canvas beside the chat AND returns what is
 * on it, so the same call gives the parent the board and gives Homa
 * eyes. Web chat renders the output as a live planner panel plus a card
 * in the transcript (planner-canvas.tsx); the phone app slides the week
 * up over the voice surface (features/voice/overlay-host.tsx) and shows
 * a planner card in chat (features/chat/planner-card.tsx); on SMS or
 * email no panel exists, so the returned summary is the whole product
 * and Homa speaks it in words. This closes the issue #256 interim
 * posture where mobile dropped planner parts and the note had to hedge.
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
 * activity check-offs stay with the parent.
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
    "Open the family's week planner beside the chat and see what is on it. Use when the parent asks what is planned, wants to see or adjust the week or the month, asks to schedule an existing lesson or curriculum onto the planner, asks how to input things into the planner, or when you are about to edit or schedule a plan and need the current activities with their indices and real scheduled dates. Pass childId to get that child's plans with all four weeks in full; without it every plan returns its current week plus per-week summaries. Each activity in a full week carries scheduledDate, the real persisted calendar date from schedule_plan_activity, or null when it has never been put on a day. In web chat this opens the planner panel next to the conversation, and in the phone app the week slides up in place; over SMS or email no panel opens, so tell the week in plain words instead. Read-only; make changes with edit_plan or schedule_plan_activity.",
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

    const [board, scheduleRows] = await Promise.all([
      getPlanBoard(familyId, input.childId ?? null),
      listScheduledDatesPinned(familyId, input.childId ?? null),
    ]);
    if (!board) {
      return { error: "unknown_child", note: WRONG_CHILD_NOTE };
    }
    const scheduledDates = scheduledDatesByActivity(scheduleRows);

    const nowMs = Date.now();
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
    const panelOpens = !NO_PANEL_CHANNELS.has(attrs.channel ?? "");
    return {
      opened: true,
      childId: input.childId ?? null,
      childName: input.childId
        ? board.children.find((child) => child.id === input.childId)?.name ?? null
        : null,
      children,
      note: [
        // Honesty wording, updated with the phone app's voice surface
        // and chat planner card (2026-07-31, supersedes the interim
        // issue #256 wording): every panel-capable client now renders
        // something real from this output. Web chat opens the planner
        // panel beside the conversation; the phone app slides the week
        // up over the voice surface and shows a planner card in chat.
        panelOpens
          ? "A planner view opens on this client: web chat shows a panel beside the conversation, and the phone app slides the week up in place (voice) or shows a planner card (chat). Do not narrate the whole week in text; a short pointer is enough. If the parent says she cannot see it, tell the week in plain words."
          : "No planner panel opens on this channel: share the week in your own words.",
        hasStored
          ? [
              "Activity indices above are what edit_plan and schedule_plan_activity address.",
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
