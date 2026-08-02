import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { z } from "zod";

import { MAP_KID_CAP } from "@homa/core";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { isSavedOnboardingCardAnswer } from "../../lib/chat-message-source";
import { emitMapEvent } from "../../lib/map/events";
import { addChild, countChildren } from "../../lib/map/store";

/**
 * Add one child to the family.
 *
 * Homa could not do this before: children arrived only through the
 * onboarding form or the SMS signup tools, so a parent who mentioned a
 * fourth kid in chat had to be sent to a settings page. Chat-first
 * onboarding needs it, and so does every family that has a baby or
 * forgets someone, which is why this is a plain tool rather than an
 * onboarding-only one.
 *
 * The same store function the web route and the SMS path already call,
 * so a child added here is byte-identical to one added anywhere else.
 */

const addChildInput = z.object({
  name: z
    .string()
    .min(1)
    .max(60)
    .describe("The child's first name, spelled the way the parent spells it."),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(
      "The child's real birthday as YYYY-MM-DD. Ask if you do not have it; an age alone is not enough, because every question plan is built from months.",
    ),
  interests: z
    .array(z.string().min(1).max(40))
    .max(8)
    .optional()
    .describe("Anything she already told you this child loves. Leave empty rather than guessing."),
});

export default defineBoundedTool({
  description:
    "Add one child to this family, with their name and real birthday. Use when the parent introduces a child Homa does not have yet, including when she names two or three in a single message: call this once per child rather than sending her back through a card for facts she already typed. Do not use to edit a child who already exists; that is update_child_profile.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: addChildInput,
  async execute(input, ctx) {
    if (isSavedOnboardingCardAnswer(ctx.session.auth.current?.attributes)) {
      return {
        added: false,
        done: true,
        note: "The authenticated child card already added this child. Do not retry this tool; continue the onboarding arc.",
      };
    }
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { added: false, note: error.message };
      }
      throw error;
    }

    const birthDate = new Date(`${input.birthDate}T00:00:00Z`);
    if (Number.isNaN(birthDate.getTime())) {
      return { added: false, note: "That birthday is not a real date. Ask her for it again." };
    }
    // A birthday in the future produces a negative age, which then picks
    // an empty question plan and a report with nothing in it. Refuse at
    // the door rather than three screens later.
    if (birthDate.getTime() > Date.now()) {
      return {
        added: false,
        note: "That birthday is in the future. Check the year with her before adding this child.",
      };
    }

    if ((await countChildren(access.familyId)) >= MAP_KID_CAP) {
      return {
        added: false,
        note: `This family already has ${MAP_KID_CAP} children, which is the most Homa holds. Say so plainly and offer to help with the ones who are here.`,
      };
    }

    const { childId, ageMonths, inRange } = await addChild(access.familyId, {
      name: input.name.trim(),
      birthDate: input.birthDate,
      interests: input.interests ?? [],
    });

    await emitMapEvent("map.child_added", {
      family_id: access.familyId,
      child_id: childId,
      age_months: ageMonths,
      in_range: inRange,
    });

    return {
      added: true,
      done: true,
      childId,
      childName: input.name.trim(),
      ageMonths,
      // inRange false means the question bank does not cover this age
      // yet. Saying so honestly beats starting a checklist that cannot
      // produce a report.
      scoredAgeRange: inRange,
      note: inRange
        ? "Added. You can start their questions when she is ready."
        : "Added, but this child is outside the ages the questions cover, so there is no report for them yet. Tell her plainly, warmly, and keep helping with them anyway.",
    };
  },
});
