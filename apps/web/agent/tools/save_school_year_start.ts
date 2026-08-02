import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  MissingFamilyContextError,
  resolveAgentAccess,
} from "../../lib/agent-db";
import {
  parseSchoolYearStart,
  setSchoolYearStart,
} from "../../lib/compliance/school-year";
import { getFilingFamily } from "../../lib/compliance/filing-store";
import { effectiveTimeZone } from "../../lib/time-zone";

export default defineBoundedTool({
  description:
    "Save the date this family's school year starts after the parent states it. Use only for an explicit date from the parent, including after open_state_records says the date is missing. The model interprets her words into YYYY-MM-DD; deterministic code verifies the calendar date and reasonable year range before writing it. Never infer a date from the current month, a state deadline, or a typical school calendar.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z.object({
    startOn: z
      .string()
      .describe("The parent's stated school-year start date as YYYY-MM-DD."),
  }),
  async execute(input, ctx) {
    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(ctx.session.auth.current?.attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { saved: false, note: error.message };
      }
      throw error;
    }
    const family = await getFilingFamily(familyId);
    if (!family) return { saved: false, note: "Could not read this family." };
    const todayIso = new Intl.DateTimeFormat("en-CA", {
      timeZone: effectiveTimeZone(family.timeZone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const parsed = parseSchoolYearStart(input.startOn, todayIso);
    if (!parsed.ok) return { saved: false, note: parsed.reason };
    await setSchoolYearStart(familyId, parsed.value);
    return {
      saved: true,
      startOn: parsed.value,
      note: "Saved from the parent's explicit answer. Call open_state_records again for the requested view or generation.",
    };
  },
});
