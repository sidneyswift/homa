import { defineTool } from "eve/tools";

import {
  MissingFamilyContextError,
  resolveAgentAccess,
} from "../../lib/agent-db";
import {
  getChildProgressView,
  listActiveFamilyProgressCheckIns,
  pauseProgressCheckIn,
  recordJournalProgressEvidence,
  resolveProgressConflict,
  respondToProgressCheckIn,
  resumeProgressCheckIn,
  startProgressCheckIn,
  stopProgressCheckIn,
  takeoverProgressCheckIn,
  undoProgressUpdate,
} from "../../lib/child-progress/runtime";
import {
  executeChildProgressTool,
  type ChildProgressToolOperations,
} from "../../lib/child-progress/tool-adapter";
import {
  createProgressToolContext,
  manageChildProgressInputSchema,
  REFUSED_PROGRESS_NOTE,
} from "../../lib/child-progress/tool-contract";

const childProgressOperations: ChildProgressToolOperations = {
  startCheckIn(context, input) {
    return startProgressCheckIn(context, {
      childId: input.childId,
      purpose: input.purpose,
      ...(input.subjectId
        ? { subjectIds: [input.subjectId] }
        : {}),
      idempotencyKey: input.idempotencyKey,
    });
  },
  respondCheckIn: respondToProgressCheckIn,
  pauseCheckIn: pauseProgressCheckIn,
  resumeCheckIn: resumeProgressCheckIn,
  stopCheckIn: stopProgressCheckIn,
  takeoverCheckIn: takeoverProgressCheckIn,
  recordJournalEvidence(context, input) {
    if (
      context.canonicalInboundText === null ||
      context.inboundMessageId === null ||
      (
        context.channel !== "web" &&
        context.channel !== "sms" &&
        context.channel !== "email"
      )
    ) {
      return Promise.resolve({ status: "no_match" });
    }
    return recordJournalProgressEvidence({
      familyId: context.familyId,
      childId: input.childId,
      memberUserId: context.memberUserId,
      quote: context.canonicalInboundText,
      channel: context.channel,
      messageId: context.inboundMessageId,
      observedAt: context.now,
      idempotencyKey: input.idempotencyKey,
      ...(input.subjectId
        ? { subjectId: input.subjectId }
        : {}),
    });
  },
  resolveConflict: resolveProgressConflict,
  undoProgressUpdate,
  listFamilyCheckIns: listActiveFamilyProgressCheckIns,
  getChildProgressView,
};

/**
 * The single model-facing ChildProgress boundary. Family and adult identity,
 * channel provenance, reply delivery, episode, and current time all come
 * from authenticated runtime context rather than the command schema.
 */
export default defineTool({
  description:
    "Manage one family's durable child progress evidence and check-ins. Use record_journal_evidence only for a concrete named child's observable capability in the current trusted inbound message. Use start_check_in when the parent asks to take a progress check-in. Continue, pause, resume, stop, take over, undo, or resolve only saved UUIDs shown by trusted context or tool results. Never invent quotes, revisions, idempotency keys, scores, or skill items.",
  inputSchema: manageChildProgressInputSchema,
  async execute(command, ctx) {
    try {
      return await executeChildProgressTool({
        command,
        createContext: () => {
          const attributes =
            ctx.session.auth.current?.attributes;
          const access = resolveAgentAccess(attributes);
          return createProgressToolContext({
            access,
            attributes,
            sessionId: ctx.session.id,
            turnId: ctx.session.turn.id,
          });
        },
        operations: childProgressOperations,
      });
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { kind: "refused" as const, note: REFUSED_PROGRESS_NOTE };
      }
      throw error;
    }
  },
});
