import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { z } from "zod";

import { MAP_BANK_VERSION, MONTH_PLAN_SUBJECT, getMapSubject } from "@homa/core";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import { createReport, getOrBuildPlan } from "../../lib/map/store";
import { loadChecklistState } from "../../lib/onboarding/checklist-state";

/**
 * Score one child's answers into their progress report, and put it on
 * screen here in the conversation.
 *
 * This is the single biggest structural fix in chat-first onboarding.
 * Today the report is earned in a form and then delivered by email, and
 * one family in four never opens the link. Revealing it inside the
 * conversation she is already in removes that gap entirely.
 *
 * The scoring itself is the same deterministic pass the web flow runs,
 * through the same store function, already advisory-locked and
 * idempotent, so a second call moments later re-reads the same numbers
 * rather than writing new ones.
 *
 * Two things this tool deliberately does NOT do: write the report's
 * narrative words, and send the report email. Both are slow, both would
 * hold the turn open while she stares at a still screen, and the report
 * card finishes them through the existing scoring route the moment it
 * mounts. The report page has always fallen back to template sentences
 * when the narrative is missing, so nothing here can leave her with a
 * blank report.
 */

export default defineBoundedTool({
  description:
    "Score one child's answers into their progress report and show it to her here. Use it the moment a child has ANY answers saved and the parent is out of the questions, finished or not: three answers score into a real (smaller) report, and a parent who leaves early should still see what her answers built. It is safe to call again for a child who already has a report; you get the same numbers back.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z.object({
    childId: z
      .uuid()
      .describe("The child to score, using an id from the family context block."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { scored: false, note: error.message };
      }
      throw error;
    }

    const state = await loadChecklistState(access.familyId, input.childId);
    if (!state) {
      return {
        scored: false,
        note: "That child id is not in this family. Use an id from the family context block.",
      };
    }
    if (state.answered === 0) {
      return {
        scored: false,
        childName: state.childName,
        note: `${state.childName} has not answered anything yet, so there is nothing to score. Offer to open their questions.`,
      };
    }

    // createReport re-scopes the child inside the family itself and
    // returns null when it does not belong; the check above already
    // covered it, and this is the belt.
    const report = await createReport(access.familyId, input.childId);
    if (!report) {
      return {
        scored: false,
        note: "That child could not be scored. Say plainly that it did not go through and offer to try again.",
      };
    }

    // A duplicate changed nothing, so it emits nothing: one scoring, one
    // event, matching the scoring route exactly.
    if (!report.duplicate) {
      await emitMapEvent("map.report_generated", {
        family_id: access.familyId,
        child_id: report.childId,
        mapped_subjects: report.scores.mappedCount,
        observations: report.scores.observationCount,
        bank_version: MAP_BANK_VERSION,
      });
    }

    const strengths = report.scores.strengthOrder
      .slice(0, 3)
      .map((subjectId) => getMapSubject(subjectId)?.displayName ?? subjectId);

    // Build her month here, so the planner has something on it.
    //
    // Walk 005 (2026-07-29) opened the planner during onboarding for the
    // first time and it read "There's no month set up for Ellie yet",
    // because scoring a report never built one and no tool could: the
    // month waited on a one-tap button in the report page that a parent
    // twelve minutes old has not found. So the arc's "this is a system,
    // not a chat" beat showed her an empty grid (gh#426, founder ruling
    // onboarding-lesson-per-subject).
    //
    // It is deterministic and cheap: buildMonthPlan is a pure function of
    // her age, her answers, and the interests she tapped on the child
    // card, and this call is one upsert on top of it. It is also
    // idempotent, returning the existing month rather than rebuilding,
    // so a second scoring does not restart her four weeks.
    //
    // Never fatal. A month that failed to build is a smaller loss than a
    // report that failed to appear, and she is watching the report.
    let monthReady = false;
    try {
      monthReady = (await getOrBuildPlan(report.token, MONTH_PLAN_SUBJECT)) !== null;
    } catch {
      monthReady = false;
    }

    return {
      scored: true,
      done: true,
      childId: report.childId,
      childName: report.childName,
      token: report.token,
      answered: state.answered,
      skipped: state.skipped,
      mappedSubjects: report.scores.mappedCount,
      totalSubjects: report.scores.totalSubjects,
      // Strongest first, from her own answers. Say these in your own
      // words; never read the list back as a list.
      strengths,
      // What she answered "not yet", in her question's exact words, so
      // the beat that must name her worry is handed the worry instead
      // of having to remember it. Empty is a real answer: she said that
      // about nothing, and there is no concern to name.
      growingEdges: state.growingEdges,
      // True when her four weeks now exist, so open_planner has a real
      // board to show. False means the month did not build and you must
      // not tell her a plan is waiting.
      monthReady,
      alreadyScored: report.duplicate,
      note:
        state.growingEdges.length > 0
          ? `SPEAK AFTER THIS ONE: the report is drawing on her screen and it wants your voice over it. Say one true thing about what it shows for this child, in your own words. Then name ONE growingEdge above, in her own question's words, as the thing this child is working on next: that is the answer she was most afraid to give and a reveal that skips it reads as flattery. Frame it as where they are growing, never as behind. Do not list subjects, do not read numbers back, do not name more than one edge, and never tell her to check her email.`
          : "SPEAK AFTER THIS ONE: the report is drawing on her screen and it wants your voice over it. Say one true thing about what it shows for this child, in your own words. She answered \"not yet\" to nothing, so there is no growing edge to name and you must not invent one. Do not list subjects, do not read numbers back, and never tell her to check her email.",
    };
  },
});
