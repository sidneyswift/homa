import { defineTool } from "eve/tools";
import { z } from "zod";

import { MAP_BANK_VERSION, getMapSubject } from "@homa/core";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import { createReport } from "../../lib/map/store";
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

export default defineTool({
  description:
    "Score one child's answers into their progress report and show it to her here. Use it the moment a child has ANY answers saved and the parent is out of the questions, finished or not: three answers score into a real (smaller) report, and a parent who leaves early should still see what her answers built. It is safe to call again for a child who already has a report; you get the same numbers back.",
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
      alreadyScored: report.duplicate,
      note: "SPEAK AFTER THIS ONE: the report is drawing on her screen and it wants your voice over it. Say one true thing about what it shows for this child, in your own words. Do not list subjects, do not read numbers back, and never tell her to check her email.",
    };
  },
});
