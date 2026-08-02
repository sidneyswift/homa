import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { z } from "zod";

import { HOMESCHOOL_STYLES } from "@homa/core";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { isSavedOnboardingCardAnswer } from "../../lib/chat-message-source";
import { saveFamilyContext } from "../../lib/map/store";
import { scanMemoryContent } from "../../lib/agent-memory";

/**
 * How this family homeschools: their approach, how structured they want
 * to be, the curriculums they use, and what matters to them.
 *
 * These four values reach every material Homa makes and every plan she
 * writes, so they are worth capturing the moment a parent volunteers
 * them. Today they are collected by a form step; in a conversation she
 * says them in passing, and this is how they get kept.
 *
 * The same store function the form step and the settings editor call, so
 * all three surfaces merge into one bag rather than three shapes.
 */

/** The stored values behind STRICTNESS_LABELS in lib/homeschool-styles.ts
 *  ("pretty closely", "loosely", "just exploring it"). Kept as the same
 *  three strings so the settings editor renders what a chat wrote. */
const STRICTNESS_VALUES = ["closely", "loosely", "exploring"] as const;

const profileInput = z
  .object({
    styles: z
      .array(z.enum(HOMESCHOOL_STYLES))
      .max(HOMESCHOOL_STYLES.length)
      .optional()
      .describe(
        "The approaches she names, from the fixed list. Only what she actually said; most families name one or two, and plenty name none.",
      ),
    strictness: z
      .enum(STRICTNESS_VALUES)
      .optional()
      .describe(
        "How closely she wants to follow her curriculum, when she says: closely, loosely, or exploring.",
      ),
    curriculums: z
      .array(z.string().min(1).max(60))
      .max(6)
      .optional()
      .describe(
        "Curriculums she uses by name, e.g. 'The Good and the Beautiful'. Her spelling, not a normalized one.",
      ),
    values: z
      .string()
      .min(1)
      .max(600)
      .optional()
      .describe(
        "What matters to her family: faith, values, screen rules, the feel she wants. Keep her own words; materials read this.",
      ),
  })
  .refine(
    (value) =>
      value.styles !== undefined ||
      value.strictness !== undefined ||
      value.curriculums !== undefined ||
      value.values !== undefined,
    { message: "Provide at least one of styles, strictness, curriculums, values." },
  );

export default defineBoundedTool({
  description:
    "Save how this family homeschools: their approach, how structured they want to be, the curriculums they use, and what matters to them. Use it when she tells you any of these in passing. Send only what she said, and never guess an approach from something adjacent.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: profileInput,
  async execute(input, ctx) {
    if (isSavedOnboardingCardAnswer(ctx.session.auth.current?.attributes)) {
      return {
        saved: false,
        done: true,
        note: "The authenticated card already saved this profile. Do not retry this tool; react to the parent instead.",
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

    // Her values line re-enters every material prompt, so it is scanned
    // exactly like a memory before it can shape future output.
    if (input.values) {
      const blocked = scanMemoryContent(input.values);
      if (blocked) return { saved: false, note: blocked };
    }

    const curriculums = input.curriculums
      ?.map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    const patch: Record<string, unknown> = {};
    if (input.styles !== undefined) patch.styles = input.styles;
    if (input.strictness !== undefined) patch.strictness = input.strictness;
    if (curriculums !== undefined && curriculums.length > 0) patch.curriculums = curriculums;
    if (input.values !== undefined) patch.values = input.values.trim();

    if (Object.keys(patch).length === 0) {
      return { saved: false, note: "Nothing to save: every field was blank after trimming." };
    }

    await saveFamilyContext(access.familyId, patch);

    return {
      saved: true,
      done: true,
      savedFields: Object.keys(patch),
      note: "Saved. Say back the one thing that changes what you will do for her, in your own words, and move on. Do not read the list back.",
    };
  },
});
