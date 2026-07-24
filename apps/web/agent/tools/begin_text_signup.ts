import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  ensureSignupFamily,
  nextChecklistItem,
  signupProgress,
} from "../../lib/sms-onboarding";
import { NOT_SMS_REFUSAL, resolveSignupSession } from "../../lib/signup-session";

/**
 * Opens (or resumes) text-native signup for the texter's own number
 * (sms-onboarding-plan SO-2). Creates the family record, links this
 * phone to it, and reports exactly what is still needed so the
 * conversation always knows the next question. Safe to call again
 * mid-flow: it never duplicates, only reports progress.
 */
export default defineBoundedTool({
  description:
    "Start or resume signing this texter up for Homa. Call it when an unlinked texter says yes to getting set up, or when a mid-signup conversation needs to know what is still missing. Returns the checklist of what to collect next. Never call it for families that already have their report.",
  deadlineMs: TOOL_DEADLINE.fetch,
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const session = await resolveSignupSession(ctx.session.auth.current?.attributes);
    if (!session) return { started: false, note: NOT_SMS_REFUSAL };

    const { familyId, created } = await ensureSignupFamily(session.phoneE164);
    const progress = await signupProgress(familyId);
    const nextQuestions = (
      await Promise.all(
        progress.children.map(async (child) => {
          if (!child.inRange || child.checklistDone) return null;
          const next = await nextChecklistItem(familyId, child.childId);
          return next
            ? {
                childId: child.childId,
                childName: child.name,
                itemId: next.itemId,
                statement: next.statement,
              }
            : null;
        }),
      )
    ).filter((question) => question !== null);
    return {
      started: true,
      resumed: !created,
      stillNeeded: progress.needs,
      children: progress.children.map((child) => ({
        childId: child.childId,
        name: child.name,
        ageMonths: child.ageMonths,
        inRange: child.inRange,
        answered: child.answered,
        checklistDone: child.checklistDone,
        hasReport: child.hasReport,
      })),
      nextQuestions,
      note:
        progress.needs.length > 0
          ? `Collect the first missing thing conversationally: ${progress.needs[0]}. One question per text.`
          : "Nothing is missing; every in-range child is scored. Their texts are linked now.",
    };
  },
});
