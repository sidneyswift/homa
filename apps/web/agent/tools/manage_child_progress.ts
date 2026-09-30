
import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  MissingFamilyContextError,
  resolveAgentAccess,
} from "../../lib/agent-db";
import {
  getChildProgressView,
  listActiveFamilyProgressCheckIns,
  markChildObservationUsed,
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
import { captureJournalClaims } from "../../lib/child-progress/journal-capture";
import {
  executeChildProgressTool,
  type ChildProgressToolOperations,
} from "../../lib/child-progress/tool-adapter";
import {
  createProgressToolContext,
  parseManageChildProgressCommand,
  manageChildProgressToolInputSchema,
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
  async recordJournalEvidence(context, input) {
    if (
      context.canonicalInboundText === null ||
      context.inboundMessageId === null ||
      (
        context.channel !== "web" &&
        context.channel !== "sms" &&
        context.channel !== "email"
      )
    ) {
      return { status: "no_match" };
    }
    // Judgment first, outside the transaction, then the deterministic
    // gate; the service below stays free of language work entirely
    // (AGENTS.md "Models judge, code verifies").
    const capture = await captureJournalClaims({
      familyId: context.familyId,
      childId: input.childId,
      message: context.canonicalInboundText,
      surface: "journal",
      conversation: { memberUserId: context.memberUserId, runtimeSessionId: context.runtimeSessionId, inboundMessageId: context.inboundMessageId, channel: context.channel },
    });
    const base = {
      familyId: context.familyId,
      memberUserId: context.memberUserId,
      quote: context.canonicalInboundText,
      channel: context.channel,
      messageId: context.inboundMessageId,
      observedAt: context.now,
      idempotencyKey: input.idempotencyKey,
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    } as const;

    // One family activity becomes one operation per child it names.
    // Safe by construction: operations are unique per
    // (child_id, family_id, idempotency_key), so siblings never collide
    // and each child keeps its own undo token.
    const siblingIds = capture.childIds.filter(
      (childId) => childId !== input.childId,
    );
    for (const siblingId of siblingIds) {
      await recordJournalProgressEvidence({
        ...base,
        childId: siblingId,
        claims: capture.claims,
      });
    }

    // The child the model named in the call is the one whose result the
    // parent hears about.
    return recordJournalProgressEvidence({
      ...base,
      childId: input.childId,
      claims: capture.claims,
    });
  },
  resolveConflict: resolveProgressConflict,
  undoProgressUpdate,
  markObservationUsed(context, input) {
    return markChildObservationUsed({
      familyId: context.familyId,
      observationId: input.observationId,
      usedTaskRunId: context.taskRunId ?? null,
      usedAt: context.now,
    });
  },
  listFamilyCheckIns: listActiveFamilyProgressCheckIns,
  getChildProgressView,
};

/**
 * The single model-facing ChildProgress boundary. Family and adult identity,
 * channel provenance, reply delivery, episode, and current time all come
 * from authenticated runtime context rather than the command schema.
 */
export default defineBoundedTool({
  description:
    "Manage one family's durable child progress evidence and check-ins. For an observable capability report or its contextual clarification, load progress-capture and use record_journal_evidence with the resolved child. The current trusted inbound message remains the only evidence quote. Use start_check_in when the parent asks to take a progress check-in. Every UUID you pass must come from trusted context or a tool result. Never invent quotes, revisions, idempotency keys, scores, or skill items.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: manageChildProgressToolInputSchema,
  async execute(input, ctx) {
    try {
      const command = parseManageChildProgressCommand(input);
      return await executeChildProgressTool({
        command,
        createContext: async () => {
          const attributes =
            ctx.session.auth.current?.attributes;
          const access = await resolveAgentAccess(attributes);
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
