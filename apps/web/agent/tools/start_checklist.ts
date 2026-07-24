import { defineDynamic } from "eve/tools";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { loadChecklistState } from "../../lib/onboarding/checklist-state";
import { writeOnboardingRecord } from "../../lib/onboarding/store";

/**
 * Open one child's questions.
 *
 * The questions take over the screen: the existing checklist experience
 * mounts full height and the conversation waits behind it. That
 * component carries six dated founder corrections (a fixed-height card
 * that never jumps, the 140ms chip flash, one kicker slot, "undo last
 * answer" rather than "back", time left rather than "question 4 of 41",
 * and the child's name inside every question), so it is mounted, never
 * rebuilt inside a chat card.
 *
 * Web only, structurally: on SMS and the server-originated channels
 * there is no screen to take over, and the SMS signup tools already own
 * that path. Returning null means the tool does not exist that turn, so
 * Homa cannot spend a call finding out.
 *
 * Idempotent. Calling it again returns the same position rather than
 * restarting anything, because every tap has already been saved.
 */

const NO_CARD_CHANNELS = new Set(["sms", "email", "dispatch", "agent-job", "subject_lesson"]);

const startChecklist = defineBoundedTool({
  description:
    "Open one child's questions on screen so the parent can answer them. Use when she is ready to start or continue a child's questions. Her taps save as she goes and she can stop anywhere. Do not use it to ask her a question yourself, and do not call it twice in a row for the same child.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z.object({
    childId: z
      .uuid()
      .describe("The child whose questions to open, using an id from the family context block."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { started: false, note: error.message };
      }
      throw error;
    }

    const state = await loadChecklistState(access.familyId, input.childId);
    if (!state) {
      return {
        started: false,
        note: "That child id is not in this family. Use an id from the family context block.",
      };
    }
    if (!state.scoredAgeRange) {
      return {
        started: false,
        childName: state.childName,
        note: `The questions do not cover ${state.childName}'s age yet, so there is nothing to open. Say so plainly and keep helping with them in other ways.`,
      };
    }
    if (state.complete) {
      return {
        started: false,
        done: true,
        childName: state.childName,
        answered: state.answered,
        note: `${state.childName} has already answered everything. If there is no report yet, score it; otherwise show her what is already there.`,
      };
    }

    await writeOnboardingRecord(access.familyId, {
      checklist: { [state.childId]: state.answered > 0 ? "resumed" : "started" },
    });

    return {
      started: true,
      childId: state.childId,
      childName: state.childName,
      answered: state.answered,
      remaining: state.remaining,
      minutesLeft: state.minutesLeft,
      resumed: state.answered > 0,
      note:
        "END TURN. Emit no text after this tool call. The questions have taken over her screen, so she is answering rather than reading; taps save as they happen and you will hear when she stops or finishes.",
    };
  },
});

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const adapterName = ctx.channel.metadata?.adapterName;
      if (adapterName === "telnyx" || ctx.channel.kind === "channel:telnyx") {
        return null;
      }
      const channel = (
        ctx.session.auth.current?.attributes as { channel?: string } | undefined
      )?.channel;
      if (channel !== undefined && NO_CARD_CHANNELS.has(channel)) return null;
      return startChecklist;
    },
  },
});
