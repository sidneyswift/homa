import * as z from "zod/mini";
import { getMapSubject } from "@homa/core";

import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";

const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_DISPLAY_STATEMENT_LENGTH = 500;
const MAX_AFFECTED_TOPICS = 12;
const MAX_TIMESTAMP_LENGTH = 40;

const displayNameSchema = z.string().check(
  z.minLength(1),
  z.maxLength(MAX_DISPLAY_NAME_LENGTH),
);
const displayStatementSchema = z.string().check(
  z.minLength(1),
  z.maxLength(MAX_DISPLAY_STATEMENT_LENGTH),
);
const offsetTimestampSchema = z.string().check(
  z.minLength(1),
  z.maxLength(MAX_TIMESTAMP_LENGTH),
  z.refine((value) => {
    try {
      parseOffsetIsoTimestampEpochNanoseconds(value);
      return true;
    } catch {
      return false;
    }
  }),
);
const evidenceAnswerSchema = z.enum([
  "easily",
  "getting_there",
  "not_yet",
]);
const uuidSchema = z.uuid();
const subjectIdSchema = z.string().check(z.maxLength(80), z.refine(id => getMapSubject(id) !== undefined));
const affectedTopicsSchema = z
  .array(displayStatementSchema)
  .check(z.maxLength(MAX_AFFECTED_TOPICS));
const requiredAffectedTopicsSchema = z
  .array(displayStatementSchema)
  .check(z.minLength(1), z.maxLength(MAX_AFFECTED_TOPICS));

export const progressResultSourceSchema = z.enum([
  "journal",
  "conversation",
  "check_in",
  "checklist",
  "deep_dive",
  "correction",
  "report_correction",
  "report_probe",
  "recheck",
  "onboarding_walk",
  "legacy",
  "lesson_listen",
]);

const nestedProgressUpdateSchema = z.strictObject({
  label: z.literal("Progress updated"),
  undoToken: uuidSchema,
  affectedTopics: requiredAffectedTopicsSchema,
});

const questionPromptSchema = z.strictObject({
  checkInId: uuidSchema,
  revision: z.int().check(z.positive()),
  childName: displayNameSchema,
  subjectDisplayName: displayNameSchema,
  statement: displayStatementSchema,
  childId: z.optional(uuidSchema),
  subjectId: z.optional(subjectIdSchema),
  acceptedResponseCount: z.optional(z.int().check(z.nonnegative())),
  responseLimit: z.optional(z.literal(8)),
  answerOptions: z.tuple([
    z.literal("easily"),
    z.literal("getting_there"),
    z.literal("not_yet"),
    z.literal("not_sure"),
    z.literal("skip"),
  ]),
});

const conflictAnswerSchema = z.strictObject({
  answer: evidenceAnswerSchema,
  adultDisplayName: z.nullable(displayNameSchema),
  observedAt: offsetTimestampSchema,
  source: progressResultSourceSchema,
});

const conflictPayloadSchema = z.strictObject({
  conflictId: uuidSchema,
  label: z.literal("Please confirm"),
  question: displayStatementSchema,
  childName: displayNameSchema,
  subjectDisplayName: displayNameSchema,
  skillStatement: displayStatementSchema,
  answers: z.tuple([conflictAnswerSchema, conflictAnswerSchema]),
  options: z.tuple([
    evidenceAnswerSchema,
    evidenceAnswerSchema,
    z.literal("ask_later"),
  ]),
});

export const ACTIVITY_ONLY_PROGRESS_NOTE =
  "This describes activity or time, so no score changed. The parent's message is saved as an observation on this child's record. Use log_hours when the parent named a school-time duration. Offer one concrete way to build on the activity this week.";
export const NO_MATCH_PROGRESS_NOTE =
  "Saved as an observation on this child's record. No score changed: the parent's message did not match a skill line yet. Tell the parent you noted it, and offer one concrete way to build on it this week. Use log_hours when the parent named a school-time duration.";
export const AMBIGUOUS_PROGRESS_NOTE =
  "More than one skill line could fit, so no score changed. The parent's message is saved as an observation. Ask one short clarifying question before recording progress. Use log_hours when the parent named a school-time duration.";
// Appended by code to EVERY journal capture, never gated on detecting a
// duration in the message: whether one was named is the model's
// judgment, and a lexical gate here would be the exact silent-loss
// pattern AGENTS.md bans (prose alone left log_hours uncalled on ~90%
// of duration-bearing recaps, measured 2026-07-25).
export const JOURNAL_HOURS_PROGRESS_NOTE =
  "Before you reply: if this message named a school-time duration, call log_hours for it now. When the child is unclear, logging with no childId is correct; ask about the child in the same reply, after the row exists. Hours rows are the family's compliance evidence; the journal never records time.";
export const OBSERVATION_USED_PROGRESS_NOTE =
  "Marked that observation as used. It will not be offered again. Do not mark it again.";
export const OBSERVATION_ALREADY_USED_PROGRESS_NOTE =
  "That observation was already marked used. Nothing changed. Do not mark it again.";
export const REFUSED_PROGRESS_NOTE =
  "Progress was not changed. Saved family data is safe. Use the current signed-in family and check-in context before trying again.";
export const REISSUE_PROGRESS_NOTE =
  "Progress was not changed. Saved family data is safe. This reply does not match a live delivered question. Call start_check_in for the child to get the current question again, send that statement word for word in your next message, then translate the parent's next reply.";
export const DISABLED_PROGRESS_NOTE =
  "Progress is not available right now. No family data was read or changed.";

export const manageChildProgressResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("progress_update"),
    label: z.literal("Progress updated"),
    // Present on journal captures only; undo and check-in updates
    // carry no hours reminder. Declared early so it serializes near
    // the top of the result the model reads.
    note: z.optional(z.literal(JOURNAL_HOURS_PROGRESS_NOTE)),
    childName: displayNameSchema,
    affectedTopics: affectedTopicsSchema,
    undoAvailable: z.boolean(),
    undoToken: z.nullable(uuidSchema),
  }),
  z.strictObject({
    kind: z.literal("progress_question"),
    prompt: questionPromptSchema,
    update: z.optional(nestedProgressUpdateSchema),
  }),
  z.strictObject({
    kind: z.literal("progress_conflict"),
    conflict: conflictPayloadSchema,
  }),
  z.strictObject({
    kind: z.literal("progress_workflow"),
    label: z.enum([
      "Check-in paused",
      "Check-in saved",
      "Check-in moved",
      "Check-in needs a choice",
      "Check-in already opened",
      "No question to ask",
    ]),
    update: z.optional(nestedProgressUpdateSchema),
    scope: z.optional(z.strictObject({ childId: uuidSchema, childName: displayNameSchema, subjectId: subjectIdSchema, subjectDisplayName: displayNameSchema, progressHref: z.optional(z.string().check(z.maxLength(200))) })),
    completion: z.optional(z.strictObject({
      reason: z.nullable(z.enum(["sitting_limit", "bank_coverage_end", "no_useful_question", "parent_stopped"])),
      acceptedResponseCount: z.nullable(z.int().check(z.nonnegative())),
      uncertainResponseCount: z.nullable(z.int().check(z.nonnegative())),
      mixedEvidence: z.boolean(),
    })),
    activeCheckIn: z.optional(z.strictObject({ checkInId: uuidSchema, ownerDisplayName: z.nullable(displayNameSchema), needsTakeover: z.boolean() })),
  }),
  z.strictObject({
    kind: z.literal("activity_only"),
    note: z.literal(ACTIVITY_ONLY_PROGRESS_NOTE),
  }),
  z.strictObject({
    kind: z.literal("no_match"),
    note: z.literal(NO_MATCH_PROGRESS_NOTE),
  }),
  z.strictObject({
    kind: z.literal("ambiguous"),
    note: z.literal(AMBIGUOUS_PROGRESS_NOTE),
  }),
  z.strictObject({
    kind: z.literal("observation_used"),
    note: z.union([
      z.literal(OBSERVATION_USED_PROGRESS_NOTE),
      z.literal(OBSERVATION_ALREADY_USED_PROGRESS_NOTE),
    ]),
  }),
  z.strictObject({
    kind: z.literal("refused"),
    note: z.union([
      z.literal(REFUSED_PROGRESS_NOTE),
      z.literal(REISSUE_PROGRESS_NOTE),
    ]),
  }),
  z.strictObject({
    kind: z.literal("disabled"),
    note: z.literal(DISABLED_PROGRESS_NOTE),
  }),
]);

export type ManageChildProgressResult = z.infer<
  typeof manageChildProgressResultSchema
>;
