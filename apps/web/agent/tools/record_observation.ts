import { BANK_ITEM_DOMAINS, getMapItem, MAP_SUBJECTS } from "@homa/core";
import { getTaxonomyDomain, hubTopics, personalizePrompt } from "@homa/taxonomy";
import { defineTool } from "eve/tools";
import { after } from "next/server";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { runReportNarrative } from "../../lib/map/narrative-runner";
import { recordObservation } from "../../lib/map/store";

/**
 * The conversation-to-map write path (skill-graph plan; the Mac Mini
 * comparison's gap #2). When a parent reports something observable in
 * chat, SMS, or a call recap, the agent records it against the matching
 * bank item; the deterministic scorer rescores the child the same way a
 * checklist sitting would, provenance says 'conversation', and the tool
 * hands back the fresh reading plus the next natural probe so Homa can
 * keep the thread going without a form.
 *
 * Tenancy law: familyId comes from session auth only; the store re-scopes
 * the child id inside the family before any write.
 */

const observationInput = z.object({
  childId: z
    .uuid()
    .describe("The child this observation is about (id from the family context block)."),
  itemId: z
    .string()
    .min(3)
    .max(80)
    .describe(
      "The bank item the parent's report matches, e.g. 'math.counts-past-20'. Only record against an item the parent's words actually evidence; when nothing matches, don't record.",
    ),
  answer: z
    .enum(["easily", "getting_there", "not_yet"])
    .describe(
      "easily = the parent described the child doing this comfortably; getting_there = emerging or with help; not_yet = the parent said the child can't do this yet.",
    ),
});

export default defineTool({
  description:
    "Record a parent's observation about a child's skill onto their progress map (e.g. 'she read a whole early-reader book by herself' or 'he still can't pedal'). Updates the map with the same honest scoring as the checklist and returns the fresh subject reading. Use it when the parent reports something concrete a child can or cannot do; never for guesses.",
  inputSchema: observationInput,
  async execute(input, ctx) {
    let access;
    try {
      access = resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { recorded: false, note: error.message };
      }
      throw error;
    }

    const found = getMapItem(input.itemId);
    if (!found) {
      const subjects = MAP_SUBJECTS.map((subject) => subject.id).join(", ");
      return {
        recorded: false,
        note: `No bank item with id "${input.itemId}". Ids look like "math.counts-past-20" with one of these subjects: ${subjects}.`,
      };
    }

    const result = await recordObservation(
      access.familyId,
      input.childId,
      input.itemId,
      input.answer,
    );
    if (!result) {
      return {
        recorded: false,
        note: "Could not record: that child id is not in this family. Use an id from the family context block.",
      };
    }

    // A rescore resets the report's words (they must match the new
    // numbers); regenerate them off-turn, same as the report-correction
    // route. The status endpoint self-heals if this gets cut short.
    after(async () => {
      try {
        await runReportNarrative(input.childId);
      } catch (error) {
        console.error("record_observation: narrative regeneration failed", error);
      }
    });

    const domain = getTaxonomyDomain(BANK_ITEM_DOMAINS[input.itemId] ?? "");

    // A runnable scenario from the skill graph (highest-centrality topic in
    // this subject at this age, assessment domains only): the raisin-test
    // style follow-up for kids old enough to sit in the graph's coverage.
    const scenario = hubTopics(found.subject.id, result.ageMonths, 5).find(
      (topic) =>
        topic.assessmentPrompt &&
        getTaxonomyDomain(topic.domain)?.kind === "assessment",
    );

    return {
      recorded: true,
      childName: result.childName,
      subject: found.subject.displayName,
      skillLine: domain?.displayName ?? null,
      statement: found.item.statement,
      newReading: {
        position: result.position,
        monthsAhead: result.monthsAhead,
        frontier: result.frontierStatement,
      },
      nextNaturalProbe: result.nextProbeStatement,
      tryAtHomeProbe: scenario?.assessmentPrompt
        ? personalizePrompt(scenario.assessmentPrompt, result.childName)
        : null,
      note: "Recorded and rescored. Mention the update to the parent in one natural aside (never clinical); if the moment invites it, the next natural probe is a good follow-up question, asked casually.",
    };
  },
});
