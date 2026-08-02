import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { z } from "zod";

import { US_STATES } from "@homa/core";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { isSavedOnboardingCardAnswer } from "../../lib/chat-message-source";
import { saveFamilyBasics } from "../../lib/onboarding/store";

const US_STATE_CODES: ReadonlySet<string> = new Set<string>(
  US_STATES.map((state) => state.code),
);

/**
 * The micro-gather's write: what to call her, what the family calls
 * itself, the state whose homeschool rules apply, and the time zone every
 * scheduled thing is timed against.
 *
 * Narrow on purpose. lib/map/store.ts saveFamilySetup is the settings
 * form's writer and blanks the avatar and address columns it does not
 * receive; this tool goes through a store function where every column
 * coalesces, so a conversation that collects two facts changes two
 * columns.
 *
 * familyId comes from the authenticated session, never from the model.
 */

const basicsInput = z
  .object({
    callMeName: z
      .string()
      .min(1)
      .max(60)
      .optional()
      .describe("What the parent wants to be called, in her own words. Usually a first name."),
    familyName: z
      .string()
      .min(1)
      .max(80)
      .optional()
      .describe("What the family calls itself, e.g. 'The Swift family'. Only when she says it."),
    usState: z
      .string()
      .length(2)
      .optional()
      .describe("Two-letter US state code. This decides which homeschool rules Homa follows."),
    timeZone: z
      .string()
      .min(3)
      .max(60)
      .optional()
      .describe(
        "IANA time zone, e.g. America/Chicago. The browser reports this with the opening message; confirm it lightly rather than announcing that you detected it.",
      ),
  })
  .refine(
    (value) =>
      value.callMeName !== undefined ||
      value.familyName !== undefined ||
      value.usState !== undefined ||
      value.timeZone !== undefined,
    { message: "Provide at least one of callMeName, familyName, usState, timeZone." },
  );

export default defineBoundedTool({
  description:
    "Save the family's basics: what to call the parent, the family's own name, their US state, and their time zone. Send only the fields she actually gave you; anything left out keeps its current value.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: basicsInput,
  async execute(input, ctx) {
    if (isSavedOnboardingCardAnswer(ctx.session.auth.current?.attributes)) {
      return {
        saved: false,
        done: true,
        note: "The authenticated card already saved these basics. Do not retry this tool; react to the parent instead.",
      };
    }
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { saved: false, note: error.message };
      }
      throw error;
    }

    // A wrong state code silently changes which homeschool rules Homa
    // quotes her, and there is no later moment where that mistake is
    // visible. Refuse rather than write a plausible-looking two letters.
    if (input.usState && !US_STATE_CODES.has(input.usState.toUpperCase())) {
      return {
        saved: false,
        note: `"${input.usState}" is not a US state code. Ask her which state she is in and use the two-letter code.`,
      };
    }

    const { savedFields } = await saveFamilyBasics(access.familyId, {
      ...(input.callMeName !== undefined ? { callMeName: input.callMeName } : {}),
      ...(input.familyName !== undefined ? { familyName: input.familyName } : {}),
      ...(input.usState !== undefined ? { usState: input.usState } : {}),
      ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
    });

    if (savedFields.length === 0) {
      return {
        saved: false,
        note: "Nothing to save: every field was blank after trimming.",
      };
    }

    return {
      saved: true,
      done: true,
      savedFields,
      note: "Saved. The new values load with family context next turn. Do not read the fields back to her; react to what she told you instead.",
    };
  },
});
