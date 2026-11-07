import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  MissingFamilyContextError,
  resolveAgentAccess,
} from "../../lib/agent-db";
import { getFilingFamily } from "../../lib/compliance/filing-store";
import { opensNativeStateRecordsView } from "../../lib/compliance/native-view";

/**
 * A narrow native UI signal. The app performs generation through the existing
 * authenticated pack and filing endpoints, then re-reads the server summary.
 * This tool does not decide state rules, generate legal content, submit a
 * filing, print, or share.
 */
export default defineBoundedTool({
  description:
    "Open the family's state-records view in the native app. Use when a parent asks to see, make, refresh, print, or share her state requirements packet or state filing. Choose generate_pack for the requirements, attendance-template, or homeschool packet; choose generate_filing for the notice, letter, form copy sheet, or filing document; choose view to inspect what exists. The app uses the family's authenticated state and school-year record, shows sources and gaps, and calls the existing deterministic generators. This tool never submits anything to a state and does not itself print or share.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    action: z
      .enum(["view", "generate_pack", "generate_filing"])
      .describe("The state-record action the parent requested."),
  }),
  async execute(input, ctx) {
    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(ctx.session.auth.current?.attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { opened: false, error: "no_family", note: error.message };
      }
      throw error;
    }
    const family = await getFilingFamily(familyId);
    if (!family?.usState) {
      return {
        opened: false,
        error: "no_state",
        note: "Ask which state the family homeschools in, then have the parent save it in Settings. Never guess a state.",
      };
    }
    if (input.action !== "view" && !family.schoolYearStartOn) {
      return {
        opened: false,
        error: "needs_school_year_start",
        state: family.usState,
        note:
          "Ask exactly one short question for the date this family's school year starts. After the parent answers, save her explicit date with save_school_year_start, then call open_state_records again. Never guess it.",
      };
    }
    // Only the iPhone app draws the state-records view (chat and voice
    // both render it from this result). Everywhere else a result saying
    // "the phone is opening" made Homa tell the parent a view opened when
    // nothing appeared, so those channels learn where the records live.
    if (!opensNativeStateRecordsView(ctx.session.auth.current?.attributes)) {
      return {
        opened: false,
        error: "no_native_view",
        action: input.action,
        state: family.usState,
        note:
          "No state-records view opens here. Tell her plainly that her state packet and filing document live in her Binder, where she can make, refresh, print and share them, and never say anything opened or was made. Nothing was filed.",
      };
    }
    return {
      opened: true,
      action: input.action,
      state: family.usState,
      schoolYearStartOn: family.schoolYearStartOn,
      note:
        "The phone is opening the family's real state-records view. Keep the reply brief because the screen shows the sources, blanks, logged school time, and current and earlier copies. Nothing was filed: the parent reviews, signs when needed, and files it herself.",
    };
  },
});
