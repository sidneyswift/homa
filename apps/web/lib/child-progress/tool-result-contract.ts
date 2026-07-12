import * as z from "zod/mini";

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
  "This describes activity or time, not a specific skill. Use log_hours for a stated duration, and use the journal or memory for the day itself.";
export const NO_MATCH_PROGRESS_NOTE =
  "No specific progress skill matched strongly enough. Keep this as journal or memory context, and do not claim a progress update.";
export const AMBIGUOUS_PROGRESS_NOTE =
  "More than one progress skill could fit. Ask one short clarifying question before recording progress.";
export const REFUSED_PROGRESS_NOTE =
  "Progress was not changed. Saved family data is safe. Use the current signed-in family and check-in context before trying again.";
export const DISABLED_PROGRESS_NOTE =
  "Progress is not available right now. No family data was read or changed.";

export const manageChildProgressResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("progress_update"),
    label: z.literal("Progress updated"),
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
    ]),
    update: z.optional(nestedProgressUpdateSchema),
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
    kind: z.literal("refused"),
    note: z.literal(REFUSED_PROGRESS_NOTE),
  }),
  z.strictObject({
    kind: z.literal("disabled"),
    note: z.literal(DISABLED_PROGRESS_NOTE),
  }),
]);

export type ManageChildProgressResult = z.infer<
  typeof manageChildProgressResultSchema
>;
