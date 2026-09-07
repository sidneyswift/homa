import { createHash } from "node:crypto";

import type { FourWeekPlan } from "@homa/core";
import { z } from "zod";

import { HOURS_SUBJECTS, type HoursSubject } from "./hours-model";
import { composeHoursNote } from "./hours-note-context";
import { sourceActivityOrdinalSchema, withLearningWriteOperation } from "./learning-write-operations";
import { mapDb, type DbJson } from "./map/db";

export const PLANNER_LEARNING_STATUSES = ["planned", "completed"] as const;
export type PlannerLearningStatus = (typeof PLANNER_LEARNING_STATUSES)[number];

export const PLANNER_LEARNING_SOURCE_CHANNELS = [
  "web",
  "mobile",
  "sms",
  "email",
  "voice",
  "dispatch",
  "agent-job",
  "other",
] as const;
export type PlannerLearningSourceChannel =
  (typeof PLANNER_LEARNING_SOURCE_CHANNELS)[number];

const uuidSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);

export interface PlannerLearningActivity {
  id: string;
  familyId: string;
  title: string;
  subject: HoursSubject;
  activityDate: string;
  status: PlannerLearningStatus;
  durationMinutes: number | null;
  note: string | null;
  sourceChannel: PlannerLearningSourceChannel;
  sourceQuote: string;
  sourceMessageId: string | null;
  completionSourceChannel: PlannerLearningSourceChannel | null;
  completionSourceQuote: string | null;
  completionSourceMessageId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  childIds: string[];
  hoursEntryIds: string[];
}

interface PlannerLearningActivityDbRow {
  id: string;
  family_id: string;
  title: string;
  subject: HoursSubject;
  activity_date: string;
  status: PlannerLearningStatus;
  duration_minutes: number | null;
  note: string | null;
  source_channel: PlannerLearningSourceChannel;
  source_quote: string;
  source_message_id: string | null;
  completion_source_channel: PlannerLearningSourceChannel | null;
  completion_source_quote: string | null;
  completion_source_message_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  child_ids: string[] | null;
  hours_entry_ids: string[] | null;
}

function toPlannerLearningActivity(
  row: PlannerLearningActivityDbRow,
): PlannerLearningActivity {
  return {
    id: row.id,
    familyId: row.family_id,
    title: row.title,
    subject: row.subject,
    activityDate: row.activity_date,
    status: row.status,
    durationMinutes: row.duration_minutes,
    note: row.note,
    sourceChannel: row.source_channel,
    sourceQuote: row.source_quote,
    sourceMessageId: row.source_message_id,
    completionSourceChannel: row.completion_source_channel,
    completionSourceQuote: row.completion_source_quote,
    completionSourceMessageId: row.completion_source_message_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    childIds: [...new Set(row.child_ids ?? [])],
    hoursEntryIds: [...new Set(row.hours_entry_ids ?? [])],
  };
}

function validDateOnly(value: string): boolean {
  if (!dateSchema.safeParse(value).success) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizedUuidList(values: readonly string[]): string[] {
  const unique = [...new Set(values.map((value) => value.toLowerCase()))];
  if (unique.length > 12 || unique.some((value) => !uuidSchema.safeParse(value).success)) {
    throw new TypeError("Planner activities accept up to 12 valid child ids");
  }
  return unique.sort();
}

export function verifyPlannerSourceQuote(input: {
  canonicalInboundText: string | null;
  sourceQuote: string;
}): string {
  const quote = input.sourceQuote.trim();
  if (
    quote.length === 0
    || Array.from(quote).length > 1_000
    || input.canonicalInboundText === null
    || !input.canonicalInboundText.includes(quote)
  ) {
    throw new TypeError(
      "Planner activity sourceQuote must be an exact span from the current parent message",
    );
  }
  return quote;
}

export function plannerLearningIdempotencyKey(input: {
  action: "record" | "complete-independent" | "complete-generated";
  sourceMessageId: string;
  identity: readonly (string | number | boolean | null)[];
}): string {
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        input.action,
        uuidSchema.parse(input.sourceMessageId).toLowerCase(),
        ...input.identity.map((value) => typeof value === "string" && uuidSchema.safeParse(value).success ? value.toLowerCase() : value),
      ]),
    )
    .digest("hex");
  return `planner-learning:${input.action}:${digest}`;
}

export function plannerLearningMutationUuid(seed: string, slot: string): string {
  const bytes = createHash("sha256")
    .update(`${seed}:${slot}`)
    .digest()
    .subarray(0, 16);
  // UUID v4 layout keeps every existing validator happy. The bytes are
  // deterministic so a retried parent message resolves to the same rows.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function plannerHoursSourceForChannel(
  channel: PlannerLearningSourceChannel,
): "chat" | "sms" | "call" | "email" | "dispatch" {
  if (channel === "voice") return "call";
  if (channel === "sms") return "sms";
  if (channel === "email") return "email";
  if (channel === "dispatch" || channel === "agent-job") return "dispatch";
  return "chat";
}

export function plannerHoursNote(sourceQuote: string, title?: string | null, note?: string | null): string {
  return composeHoursNote({ title, note, sourceQuote }).text;
}

export interface RecordPlannerLearningActivityInput {
  familyId: string;
  title: string;
  subject: HoursSubject;
  activityDate: string;
  status: PlannerLearningStatus;
  durationMinutes?: number | null;
  note?: string | null;
  childIds: readonly string[];
  sourceChannel: PlannerLearningSourceChannel;
  sourceQuote: string;
  sourceMessageId: string;
  idempotencyKey: string;
  sourceActivityOrdinal: number;
  activityId?: string;
  hoursEntryIds?: readonly string[];
}

export type RecordPlannerLearningActivityResult =
  | { status: "recorded"; activity: PlannerLearningActivity; created: boolean }
  | { status: "unknown_child"; note: string }
  | { status: "conflict"; note: string };

/**
 * Server-pinned Planner write. The family comes from authenticated runtime
 * context, while every child id is re-scoped inside that family under the
 * same transaction as the activity and optional Hours rows.
 */
export async function recordPlannerLearningActivity(
  input: RecordPlannerLearningActivityInput,
): Promise<RecordPlannerLearningActivityResult> {
  const title = input.title.trim();
  const note = input.note?.trim() || null;
  const childIds = normalizedUuidList(input.childIds);
  const durationMinutes = input.durationMinutes ?? null;
  if (!uuidSchema.safeParse(input.familyId).success) {
    throw new TypeError("Planner activity requires a valid authenticated family id");
  }
  if (title.length < 1 || title.length > 300) {
    throw new TypeError("Planner activity title must be between 1 and 300 characters");
  }
  if (!(HOURS_SUBJECTS as readonly string[]).includes(input.subject)) {
    throw new TypeError("Planner activity subject is invalid");
  }
  if (!validDateOnly(input.activityDate)) {
    throw new TypeError("Planner activity date is invalid");
  }
  if (
    durationMinutes !== null
    && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600)
  ) {
    throw new TypeError("Planner activity duration must be between 1 and 600 minutes");
  }
  if (input.status === "planned" && durationMinutes !== null) {
    throw new TypeError("Only completed Planner activities can carry actual time");
  }
  if (note !== null && note.length > 500) {
    throw new TypeError("Planner activity note is too long");
  }
  if (!uuidSchema.safeParse(input.sourceMessageId).success) {
    throw new TypeError("Planner activity requires trusted message identity");
  }
  if (input.idempotencyKey.length < 16 || input.idempotencyKey.length > 200) {
    throw new TypeError("Planner activity idempotency key is invalid");
  }
  sourceActivityOrdinalSchema.parse(input.sourceActivityOrdinal);
  const expectedKey = plannerLearningIdempotencyKey({ action: "record", sourceMessageId: input.sourceMessageId,
    identity: [input.sourceActivityOrdinal] });
  if (input.idempotencyKey !== expectedKey) throw new TypeError("Planner capture identity is invalid");
  const activityId = input.activityId ?? plannerLearningMutationUuid(expectedKey, "activity");
  if (activityId !== plannerLearningMutationUuid(expectedKey, "activity")) throw new TypeError("Planner activity identity is invalid");
  if (!uuidSchema.safeParse(activityId).success) {
    throw new TypeError("Planner activity id is invalid");
  }
  const expectedHoursCount = durationMinutes === null
    ? 0
    : Math.max(1, childIds.length);
  const proposedHoursEntryIds = input.hoursEntryIds === undefined
    ? Array.from({ length: expectedHoursCount }, (_, index) => plannerLearningMutationUuid(input.idempotencyKey, `hours:${index}`))
    : [...input.hoursEntryIds];
  if (
    proposedHoursEntryIds.length !== expectedHoursCount
    || proposedHoursEntryIds.some((id, index) => id !== plannerLearningMutationUuid(input.idempotencyKey, `hours:${index}`))
    || new Set(proposedHoursEntryIds).size !== proposedHoursEntryIds.length
  ) {
    throw new TypeError("Planner activity Hours identities are invalid");
  }

  return await withLearningWriteOperation({
    familyId: input.familyId, key: input.idempotencyKey, sourceMessageId: input.sourceMessageId,
    sourceQuote: input.sourceQuote, hoursIds: proposedHoursEntryIds, requestedDate: input.activityDate,
    request: { sourceActivityOrdinal: input.sourceActivityOrdinal, title, subject: input.subject, activityDate: input.activityDate, status: input.status,
      durationMinutes, note, childIds, sourceChannel: input.sourceChannel },
  }, async (tx, operation): Promise<RecordPlannerLearningActivityResult> => {
    const existing = await tx<PlannerLearningActivityDbRow[]>`
      select activity.id, activity.family_id, activity.title, activity.subject,
             activity.activity_date::text, activity.status,
             activity.duration_minutes, activity.note, activity.source_channel,
             activity.source_quote, activity.source_message_id,
             activity.completion_source_channel,
             activity.completion_source_quote,
             activity.completion_source_message_id,
             activity.completed_at::text, activity.created_at::text,
             activity.updated_at::text,
             coalesce(array_agg(distinct child.child_id)
               filter (where child.child_id is not null), '{}') as child_ids,
             coalesce(array_agg(distinct hour.hours_entry_id)
               filter (where hour.hours_entry_id is not null), '{}') as hours_entry_ids
      from public.planner_learning_activities activity
      left join public.planner_learning_activity_children child
        on child.activity_id = activity.id and child.family_id = activity.family_id
      left join public.planner_learning_activity_hours hour
        on hour.activity_id = activity.id and hour.family_id = activity.family_id
      where activity.family_id = ${input.familyId}
        and activity.idempotency_key = ${input.idempotencyKey}
      group by activity.id
    `;
    if (!operation.inserted && !existing[0]) {
      return { status: "conflict", note: "That activity was removed after it was recorded. Nothing was recreated." };
    }
    if (existing[0]) {
      return {
        status: "recorded",
        activity: toPlannerLearningActivity(existing[0]),
        created: false,
      };
    }

    if (childIds.length > 0) {
      const familyChildren = await tx<{ id: string }[]>`
        select id from public.children
        where family_id = ${input.familyId}
          and id = any(${tx.array(childIds)}::uuid[])
        for key share
      `;
      if (familyChildren.length !== childIds.length) {
        return {
          status: "unknown_child",
          note: "One of those child ids is not in this family. Use only ids from the family context block.",
        };
      }
    }

    const completed = input.status === "completed";
    const [insertedActivity] = await tx<{ created_at: string; updated_at: string; completed_at: string | null }[]>`
      insert into public.planner_learning_activities (
        id, family_id, title, subject, activity_date, status,
        duration_minutes, note, source_channel, source_quote,
        source_message_id, idempotency_key, completion_source_channel,
        completion_source_quote, completion_source_message_id,
        completion_idempotency_key, completed_at
      ) values (
        ${activityId}, ${input.familyId}, ${title}, ${input.subject},
        ${input.activityDate}, ${input.status}, ${durationMinutes}, ${note},
        ${input.sourceChannel}, ${input.sourceQuote}, ${input.sourceMessageId},
        ${input.idempotencyKey},
        ${completed ? input.sourceChannel : null},
        ${completed ? input.sourceQuote : null},
        ${completed ? input.sourceMessageId : null},
        ${completed ? input.idempotencyKey : null},
        case when ${completed} then now() else null end
      )
      returning created_at::text, updated_at::text, completed_at::text
    `;
    if (!insertedActivity) throw new Error("Planner did not return its saved timestamps");

    for (const childId of childIds) {
      await tx`
        insert into public.planner_learning_activity_children
          (family_id, activity_id, child_id)
        values (${input.familyId}, ${activityId}, ${childId})
      `;
    }

    const hoursEntryIds: string[] = [];
    if (durationMinutes !== null) {
      const hoursChildren = childIds.length === 0 ? [null] : childIds;
      for (const [index, childId] of hoursChildren.entries()) {
        const proposedHoursId = proposedHoursEntryIds[index];
        const inserted = await tx<{ id: string }[]>`
          insert into public.hours_log
            (id, family_id, child_id, subject, minutes, happened_on, source, note, capture_operation_id)
          values (
            ${proposedHoursId}, ${input.familyId}, ${childId}, ${input.subject},
            ${durationMinutes}, ${input.activityDate},
            ${plannerHoursSourceForChannel(input.sourceChannel)},
            ${plannerHoursNote(input.sourceQuote, title, note)}, ${operation.id}
          )
          returning id
        `;
        const hoursId = inserted[0]?.id;
        if (!hoursId) {
          throw new Error("Planner activity could not verify its Hours entry");
        }
        hoursEntryIds.push(hoursId);
        await tx`
          insert into public.planner_learning_activity_hours
            (family_id, activity_id, hours_entry_id)
          values (${input.familyId}, ${activityId}, ${hoursId})
          on conflict do nothing
        `;
      }
    }

    return {
      status: "recorded",
      created: true,
      activity: {
        id: activityId,
        familyId: input.familyId,
        title,
        subject: input.subject,
        activityDate: input.activityDate,
        status: input.status,
        durationMinutes,
        note,
        sourceChannel: input.sourceChannel,
        sourceQuote: input.sourceQuote,
        sourceMessageId: input.sourceMessageId,
        completionSourceChannel: completed ? input.sourceChannel : null,
        completionSourceQuote: completed ? input.sourceQuote : null,
        completionSourceMessageId: completed ? input.sourceMessageId : null,
        completedAt: insertedActivity.completed_at,
        createdAt: insertedActivity.created_at,
        updatedAt: insertedActivity.updated_at,
        childIds,
        hoursEntryIds,
      },
    };
  });
}

export interface CompletePlannerLearningActivityInput {
  /** Caller snapshot for exact Voice undo; checked only on a new completion. */
  expectedUpdatedAt?: string;
  familyId: string;
  activityId: string;
  expectedStatus: "planned";
  durationMinutes?: number | null;
  sourceChannel: PlannerLearningSourceChannel;
  sourceQuote: string;
  sourceMessageId: string;
  idempotencyKey: string;
  hoursEntryIds?: readonly string[];
}

export type CompletePlannerLearningActivityResult =
  | { status: "completed"; activity: PlannerLearningActivity; changed: boolean }
  | { status: "conflict"; reason: "missing" | "status-mismatch"; note: string };

export async function getPlannerLearningActivityPinned(input: {
  familyId: string;
  activityId: string;
}): Promise<PlannerLearningActivity | null> {
  if (
    !uuidSchema.safeParse(input.familyId).success
    || !uuidSchema.safeParse(input.activityId).success
  ) {
    throw new TypeError("Planner activity identity is invalid");
  }
  const sql = mapDb();
  const rows = await sql<PlannerLearningActivityDbRow[]>`
    select activity.id, activity.family_id, activity.title, activity.subject,
           activity.activity_date::text, activity.status,
           activity.duration_minutes, activity.note, activity.source_channel,
           activity.source_quote, activity.source_message_id,
           activity.completion_source_channel,
           activity.completion_source_quote,
           activity.completion_source_message_id,
           activity.completed_at::text, activity.created_at::text,
           activity.updated_at::text,
           coalesce(array_agg(distinct child.child_id)
             filter (where child.child_id is not null), '{}') as child_ids,
           coalesce(array_agg(distinct hour.hours_entry_id)
             filter (where hour.hours_entry_id is not null), '{}') as hours_entry_ids
    from public.planner_learning_activities activity
    left join public.planner_learning_activity_children child
      on child.activity_id = activity.id and child.family_id = activity.family_id
    left join public.planner_learning_activity_hours hour
      on hour.activity_id = activity.id and hour.family_id = activity.family_id
    where activity.id = ${input.activityId}
      and activity.family_id = ${input.familyId}
    group by activity.id
  `;
  return rows[0] ? toPlannerLearningActivity(rows[0]) : null;
}

export async function completePlannerLearningActivity(
  input: CompletePlannerLearningActivityInput,
): Promise<CompletePlannerLearningActivityResult> {
  const durationMinutes = input.durationMinutes ?? null;
  if (
    durationMinutes !== null
    && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600)
  ) {
    throw new TypeError("Planner activity duration must be between 1 and 600 minutes");
  }
  const expectedKey = plannerLearningIdempotencyKey({ action: "complete-independent",
    sourceMessageId: input.sourceMessageId, identity: [input.activityId] });
  if (input.idempotencyKey !== expectedKey) throw new TypeError("Planner completion identity is invalid");
  const prior = await getPlannerLearningActivityPinned({ familyId: input.familyId, activityId: input.activityId });
  const count = durationMinutes === null ? 0 : Math.max(1, prior?.childIds.length ?? 0);
  const expectedHoursIds = input.hoursEntryIds ?? Array.from({ length: count }, (_, index) =>
    plannerLearningMutationUuid(expectedKey, `hours:${index}`));
  return await withLearningWriteOperation({
    familyId: input.familyId, key: expectedKey, sourceMessageId: input.sourceMessageId,
    sourceQuote: input.sourceQuote, hoursIds: expectedHoursIds, requestedDate: null,
    request: { activityId: input.activityId.toLowerCase(), expectedStatus: input.expectedStatus,
      durationMinutes, sourceChannel: input.sourceChannel },
  }, async (tx, operation): Promise<CompletePlannerLearningActivityResult> => {
    const rows = await tx<PlannerLearningActivityDbRow[]>`
      select activity.id, activity.family_id, activity.title, activity.subject,
             activity.activity_date::text, activity.status,
             activity.duration_minutes, activity.note, activity.source_channel,
             activity.source_quote, activity.source_message_id,
             activity.completion_source_channel,
             activity.completion_source_quote,
             activity.completion_source_message_id,
             activity.completed_at::text, activity.created_at::text,
             activity.updated_at::text,
             '{}'::uuid[] as child_ids,
             '{}'::uuid[] as hours_entry_ids
      from public.planner_learning_activities activity
      where activity.id = ${input.activityId}
        and activity.family_id = ${input.familyId}
      for update of activity
    `;
    const current = rows[0];
    if (!current) {
      return {
        status: "conflict",
        reason: "missing",
        note: "That Planner activity is no longer there. Nothing changed.",
      };
    }
    const childRows = await tx<{ child_id: string }[]>`
      select child_id
      from public.planner_learning_activity_children
      where activity_id = ${current.id}
        and family_id = ${input.familyId}
      order by child_id
    `;
    const hoursRows = await tx<{ hours_entry_id: string }[]>`
      select hours_entry_id
      from public.planner_learning_activity_hours
      where activity_id = ${current.id}
        and family_id = ${input.familyId}
      order by hours_entry_id
    `;
    const childIds = childRows.map((row) => row.child_id);
    const existingHoursEntryIds = hoursRows.map((row) => row.hours_entry_id);
    if (!operation.inserted) {
      if (current.status === "completed") {
        return {
          status: "completed",
          activity: toPlannerLearningActivity({
            ...current,
            child_ids: childIds,
            hours_entry_ids: existingHoursEntryIds,
          }),
          changed: false,
        };
      }
      return {
        status: "conflict",
        reason: "status-mismatch",
        note: "That Planner activity was already completed. Nothing was added twice.",
      };
    }

    if (input.expectedUpdatedAt !== undefined && current.updated_at !== input.expectedUpdatedAt) {
      return { status: "conflict", reason: "status-mismatch", note: "That activity changed while Homa was saving it. Reopen it before recording time." };
    }

    if (current.status !== input.expectedStatus) {
      return { status: "conflict", reason: "status-mismatch", note: "That activity is already finished. No additional time was recorded." };
    }
    const expectedHoursCount = durationMinutes === null
      ? 0
      : Math.max(1, childIds.length);
    const proposedHoursEntryIds = input.hoursEntryIds === undefined
      ? Array.from({ length: expectedHoursCount }, (_, index) => plannerLearningMutationUuid(input.idempotencyKey, `hours:${index}`))
      : [...input.hoursEntryIds];
    if (
      proposedHoursEntryIds.length !== expectedHoursCount
      || proposedHoursEntryIds.some((id, index) => id !== plannerLearningMutationUuid(input.idempotencyKey, `hours:${index}`))
      || new Set(proposedHoursEntryIds).size !== proposedHoursEntryIds.length
    ) {
      throw new TypeError("Planner completion Hours identities are invalid");
    }
    const hoursEntryIds: string[] = [...existingHoursEntryIds];
    if (durationMinutes !== null) {
      const hoursChildren = childIds.length === 0 ? [null] : childIds;
      for (const [index, childId] of hoursChildren.entries()) {
        const proposedHoursId = proposedHoursEntryIds[index];
        const inserted = await tx<{ id: string }[]>`
          insert into public.hours_log
            (id, family_id, child_id, subject, minutes, happened_on, source, note, capture_operation_id)
          values (
            ${proposedHoursId}, ${input.familyId}, ${childId}, ${current.subject},
            ${durationMinutes}, ${current.activity_date},
            ${plannerHoursSourceForChannel(input.sourceChannel)},
            ${plannerHoursNote(input.sourceQuote, current.title, current.note)}, ${operation.id}
          )
          returning id
        `;
        const hoursId = inserted[0]?.id;
        if (!hoursId) throw new Error("Planner activity could not verify its Hours entry");
        hoursEntryIds.push(hoursId);
        await tx`
          insert into public.planner_learning_activity_hours
            (family_id, activity_id, hours_entry_id)
          values (${input.familyId}, ${current.id}, ${hoursId})
          on conflict do nothing
        `;
      }
    }

    const updated = await tx<PlannerLearningActivityDbRow[]>`
      update public.planner_learning_activities activity
      set status = 'completed', duration_minutes = ${durationMinutes},
          completion_source_channel = ${input.sourceChannel},
          completion_source_quote = ${input.sourceQuote},
          completion_source_message_id = ${input.sourceMessageId},
          completion_idempotency_key = ${input.idempotencyKey},
          completed_at = now(), updated_at = now()
      where activity.id = ${current.id}
        and activity.family_id = ${input.familyId}
        and activity.status = ${input.expectedStatus}
      returning activity.id, activity.family_id, activity.title,
                activity.subject, activity.activity_date::text,
                activity.status, activity.duration_minutes, activity.note,
                activity.source_channel, activity.source_quote,
                activity.source_message_id, activity.completion_source_channel,
                activity.completion_source_quote,
                activity.completion_source_message_id,
                activity.completed_at::text, activity.created_at::text,
                activity.updated_at::text,
                ${tx.array(childIds)}::uuid[] as child_ids,
                ${tx.array(hoursEntryIds)}::uuid[] as hours_entry_ids
    `;
    if (!updated[0]) {
      throw new Error("Planner activity changed while Homa was completing it");
    }
    return {
      status: "completed",
      activity: toPlannerLearningActivity(updated[0]),
      changed: true,
    };
  });
}

export interface CompleteGeneratedPlanActivityInput {
  familyId: string;
  childId: string;
  subjectId: string;
  week: number;
  activityIndex: number;
  expectedText: string;
  planRevision: number;
  happenedOn: string;
  durationMinutes?: number | null;
  hoursSubject?: HoursSubject | null;
  sourceChannel: PlannerLearningSourceChannel;
  sourceQuote: string;
  sourceMessageId: string;
  idempotencyKey: string;
  hoursEntryId?: string | null;
}

export type CompleteGeneratedPlanActivityResult =
  | {
      status: "completed";
      planId: string;
      progressKey: string;
      progressRevision: number;
      changed: boolean;
      hoursEntryIds: string[];
    }
  | {
      status: "conflict";
      reason: "missing" | "revision-mismatch" | "activity-mismatch" | "invalid-plan";
      note: string;
    };

type GeneratedPlanActivityConflict = Extract<
  CompleteGeneratedPlanActivityResult,
  { status: "conflict" }
>;

export type GeneratedPlanActivityCompletionTarget =
  | {
      status: "ready";
      planId: string;
      progressKey: string;
      progressRevision: number;
      previousValue: boolean | null;
    }
  | GeneratedPlanActivityConflict;

interface GeneratedPlanRow {
  id: string;
  plan: FourWeekPlan;
  progress: Record<string, boolean> | null;
  plan_revision: number;
  progress_revision: number;
}

function generatedPlanConflict(
  reason: GeneratedPlanActivityConflict["reason"],
): GeneratedPlanActivityConflict {
  const notes: Record<GeneratedPlanActivityConflict["reason"], string> = {
    missing: "That saved plan is no longer there. Nothing changed.",
    "revision-mismatch": "That plan changed since Homa opened it. Nothing changed. Open Planner again before retrying.",
    "activity-mismatch": "That activity changed since Homa opened Planner. Nothing changed. Open Planner again before retrying.",
    "invalid-plan": "That plan is not safe to update. Nothing changed.",
  };
  return { status: "conflict", reason, note: notes[reason] };
}

function inspectGeneratedPlanRow(input: {
  row: GeneratedPlanRow;
  week: number;
  activityIndex: number;
  expectedText: string;
  planRevision: number;
}): GeneratedPlanActivityCompletionTarget {
  if (input.row.plan_revision !== input.planRevision) {
    return generatedPlanConflict("revision-mismatch");
  }
  const weeks = Array.isArray(input.row.plan?.weeks) ? input.row.plan.weeks : [];
  const matchingWeeks = weeks.filter((entry) => entry.week === input.week);
  if (matchingWeeks.length !== 1 || !Array.isArray(matchingWeeks[0].activities)) {
    return generatedPlanConflict("invalid-plan");
  }
  const actualText = matchingWeeks[0].activities[input.activityIndex];
  if (typeof actualText !== "string") return generatedPlanConflict("invalid-plan");
  if (actualText !== input.expectedText) return generatedPlanConflict("activity-mismatch");

  const progress = input.row.progress ?? {};
  for (const [key, value] of Object.entries(progress)) {
    const match = /^([1-4])\.(0|[1-9][0-9]{0,2})$/u.exec(key);
    if (!match || typeof value !== "boolean") {
      return generatedPlanConflict("invalid-plan");
    }
    const progressWeek = Number(match[1]);
    const progressIndex = Number(match[2]);
    const matchingProgressWeeks = weeks.filter((entry) => entry.week === progressWeek);
    if (
      matchingProgressWeeks.length !== 1
      || !Array.isArray(matchingProgressWeeks[0].activities)
      || typeof matchingProgressWeeks[0].activities[progressIndex] !== "string"
    ) {
      return generatedPlanConflict("invalid-plan");
    }
  }
  const progressKey = `${input.week}.${input.activityIndex}`;
  return {
    status: "ready",
    planId: input.row.id,
    progressKey,
    progressRevision: input.row.progress_revision,
    previousValue: Object.hasOwn(progress, progressKey) ? progress[progressKey] : null,
  };
}

export async function getGeneratedPlanActivityCompletionTarget(input: {
  familyId: string;
  childId: string;
  subjectId: string;
  week: number;
  activityIndex: number;
  expectedText: string;
  planRevision: number;
}): Promise<GeneratedPlanActivityCompletionTarget> {
  const sql = mapDb();
  const rows = await sql<GeneratedPlanRow[]>`
    select plan.id, plan.plan, plan.progress,
           plan.plan_revision::integer as plan_revision,
           plan.progress_revision::integer as progress_revision
    from public.child_plans plan
    join public.children child
      on child.id = plan.child_id and child.family_id = ${input.familyId}
    where plan.child_id = ${input.childId}
      and plan.subject_id = ${input.subjectId}
    limit 1
  `;
  if (!rows[0]) return generatedPlanConflict("missing");
  return inspectGeneratedPlanRow({ row: rows[0], ...input });
}

/** Exact server-side counterpart to set_plan_activity_check_v2 for Homa. */
export async function completeGeneratedPlanActivity(
  input: CompleteGeneratedPlanActivityInput,
): Promise<CompleteGeneratedPlanActivityResult> {
  if (
    !Number.isInteger(input.week)
    || input.week < 1
    || input.week > 4
    || !Number.isInteger(input.activityIndex)
    || input.activityIndex < 0
    || !Number.isInteger(input.planRevision)
    || input.planRevision < 1
    || input.expectedText.length < 1
    || input.expectedText.length > 4_000
    || !validDateOnly(input.happenedOn)
  ) {
    throw new TypeError("Generated Planner activity identity is invalid");
  }
  const durationMinutes = input.durationMinutes ?? null;
  if (
    durationMinutes !== null
    && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600)
  ) {
    throw new TypeError("Planner activity duration must be between 1 and 600 minutes");
  }
  if ((durationMinutes === null) !== (input.hoursSubject == null)) {
    throw new TypeError("Duration and Hours subject must be supplied together");
  }
  const expectedKey = plannerLearningIdempotencyKey({ action: "complete-generated", sourceMessageId: input.sourceMessageId,
    identity: [input.childId, input.subjectId, input.week, input.activityIndex, input.planRevision] });
  if (input.idempotencyKey !== expectedKey) throw new TypeError("Generated completion identity is invalid");
  const proposedHoursEntryId = input.hoursEntryId ?? (
    durationMinutes === null ? null : plannerLearningMutationUuid(expectedKey, "hours:0")
  );
  if (
    (durationMinutes === null) !== (proposedHoursEntryId === null)
    || (proposedHoursEntryId !== null && proposedHoursEntryId !== plannerLearningMutationUuid(expectedKey, "hours:0"))
  ) {
    throw new TypeError("Generated Planner completion Hours identity is invalid");
  }

  return await withLearningWriteOperation({
    familyId: input.familyId, key: expectedKey, sourceMessageId: input.sourceMessageId,
    sourceQuote: input.sourceQuote, hoursIds: proposedHoursEntryId ? [proposedHoursEntryId] : [], requestedDate: input.happenedOn,
    request: { childId: input.childId.toLowerCase(), subjectId: input.subjectId, week: input.week, activityIndex: input.activityIndex,
      expectedText: input.expectedText, planRevision: input.planRevision, happenedOn: input.happenedOn,
      durationMinutes, hoursSubject: input.hoursSubject ?? null, sourceChannel: input.sourceChannel },
  }, async (tx, operation): Promise<CompleteGeneratedPlanActivityResult> => {
    const rows = await tx<GeneratedPlanRow[]>`
      select plan.id, plan.plan, plan.progress,
             plan.plan_revision::integer as plan_revision,
             plan.progress_revision::integer as progress_revision
      from public.child_plans plan
      join public.children child
        on child.id = plan.child_id and child.family_id = ${input.familyId}
      where plan.child_id = ${input.childId}
        and plan.subject_id = ${input.subjectId}
      for update of plan
    `;
    const plan = rows[0];
    if (!plan) {
      return {
        status: "conflict",
        reason: "missing",
        note: "That saved plan is no longer there. Nothing changed.",
      };
    }
    const inspected = inspectGeneratedPlanRow({ row: plan, ...input });
    if (inspected.status === "conflict") return inspected;
    const progressKey = inspected.progressKey;
    const progress = plan.progress ?? {};
    if (!operation.inserted && progress[progressKey] !== true) {
      return generatedPlanConflict("activity-mismatch");
    }
    if (operation.inserted && progress[progressKey] === true) {
      return generatedPlanConflict("activity-mismatch");
    }
    if (progress[progressKey] === true) {
      const currentHours = proposedHoursEntryId ? await tx<{ id: string }[]>`
        select id from public.hours_log where family_id = ${input.familyId} and id = ${proposedHoursEntryId}
      ` : [];
      return {
        status: "completed",
        planId: plan.id,
        progressKey,
        progressRevision: plan.progress_revision,
        changed: false,
        hoursEntryIds: currentHours.map((row) => row.id),
      };
    }

    const nextProgress = { ...progress, [progressKey]: true };
    const updated = await tx<{ progress_revision: number }[]>`
      update public.child_plans target
      set progress = ${tx.json(nextProgress as unknown as DbJson)},
          updated_at = now()
      where target.id = ${plan.id}
        and target.plan_revision = ${input.planRevision}
      returning target.progress_revision::integer as progress_revision
    `;
    if (!updated[0]) {
      throw new Error("Generated Planner activity changed while Homa was completing it");
    }

    const hoursEntryIds: string[] = [];
    if (durationMinutes !== null && input.hoursSubject) {
      const inserted = await tx<{ id: string }[]>`
        insert into public.hours_log
          (id, family_id, child_id, subject, minutes, happened_on, source, note, capture_operation_id)
        values (
          ${proposedHoursEntryId}, ${input.familyId}, ${input.childId},
          ${input.hoursSubject}, ${durationMinutes}, ${input.happenedOn},
          ${plannerHoursSourceForChannel(input.sourceChannel)},
          ${plannerHoursNote(input.sourceQuote, input.expectedText)}, ${operation.id}
        )
        returning id
      `;
      const hoursId = inserted[0]?.id;
      if (!hoursId) throw new Error("Planner completion could not verify its Hours entry");
      hoursEntryIds.push(hoursId);
    }

    return {
      status: "completed",
      planId: plan.id,
      progressKey,
      progressRevision: updated[0].progress_revision,
      changed: true,
      hoursEntryIds,
    };
  });
}

export interface PlannerLearningActivityCandidate {
  id: string;
  title: string;
  subject: HoursSubject;
  status: PlannerLearningStatus;
  childIds: string[];
}

/**
 * Same-day, same-subject rows already logged for any of these children (or
 * covering the whole family), so record_planner_activity's duplicate guard
 * can surface them instead of silently writing a second row for work that
 * is already there (gh#1015). excludeActivityId keeps a retried idempotent
 * call from flagging its own prior write: the caller already computed the
 * deterministic id this exact call would produce before checking.
 */
export async function findLoggedActivityCandidates(input: {
  familyId: string;
  childIds: readonly string[];
  subject: HoursSubject;
  activityDate: string;
  excludeActivityId: string;
}): Promise<PlannerLearningActivityCandidate[]> {
  if (input.childIds.length === 0) return [];
  const sql = mapDb();
  const rows = await sql<{
    id: string;
    title: string;
    subject: HoursSubject;
    status: PlannerLearningStatus;
    child_ids: string[] | null;
  }[]>`
    select activity.id, activity.title, activity.subject, activity.status,
           coalesce(array_agg(distinct child.child_id)
             filter (where child.child_id is not null), '{}') as child_ids
    from public.planner_learning_activities activity
    left join public.planner_learning_activity_children child
      on child.activity_id = activity.id and child.family_id = activity.family_id
    where activity.family_id = ${input.familyId}
      and activity.subject = ${input.subject}
      and activity.activity_date = ${input.activityDate}
      and activity.id != ${input.excludeActivityId}
      and (
        not exists (
          select 1 from public.planner_learning_activity_children any_child
          where any_child.activity_id = activity.id
            and any_child.family_id = activity.family_id
        )
        or exists (
          select 1 from public.planner_learning_activity_children selected_child
          where selected_child.activity_id = activity.id
            and selected_child.family_id = activity.family_id
            and selected_child.child_id = any(${sql.array([...input.childIds])}::uuid[])
        )
      )
    group by activity.id
    order by activity.created_at
    limit 5
  `;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    subject: row.subject,
    status: row.status,
    childIds: [...new Set(row.child_ids ?? [])],
  }));
}

/** Bounded read for open_planner and server-originated Planner context. */
export async function listPlannerLearningActivitiesPinned(input: {
  familyId: string;
  fromDate: string;
  toDate: string;
  childId?: string | null;
  limit?: number;
}): Promise<PlannerLearningActivity[]> {
  if (!validDateOnly(input.fromDate) || !validDateOnly(input.toDate)) {
    throw new TypeError("Planner activity read window is invalid");
  }
  const sql = mapDb();
  const rows = await sql<PlannerLearningActivityDbRow[]>`
    select activity.id, activity.family_id, activity.title, activity.subject,
           activity.activity_date::text, activity.status,
           activity.duration_minutes, activity.note, activity.source_channel,
           activity.source_quote, activity.source_message_id,
           activity.completion_source_channel,
           activity.completion_source_quote,
           activity.completion_source_message_id,
           activity.completed_at::text, activity.created_at::text,
           activity.updated_at::text,
           coalesce(array_agg(distinct child.child_id)
             filter (where child.child_id is not null), '{}') as child_ids,
           coalesce(array_agg(distinct hour.hours_entry_id)
             filter (where hour.hours_entry_id is not null), '{}') as hours_entry_ids
    from public.planner_learning_activities activity
    left join public.planner_learning_activity_children child
      on child.activity_id = activity.id and child.family_id = activity.family_id
    left join public.planner_learning_activity_hours hour
      on hour.activity_id = activity.id and hour.family_id = activity.family_id
    where activity.family_id = ${input.familyId}
      and activity.activity_date between ${input.fromDate} and ${input.toDate}
      and (
        ${input.childId ?? null}::uuid is null
        or not exists (
          select 1 from public.planner_learning_activity_children any_child
          where any_child.activity_id = activity.id
            and any_child.family_id = activity.family_id
        )
        or exists (
          select 1 from public.planner_learning_activity_children selected_child
          where selected_child.activity_id = activity.id
            and selected_child.family_id = activity.family_id
            and selected_child.child_id = ${input.childId ?? null}
        )
      )
    group by activity.id
    order by activity.activity_date, activity.created_at
    limit ${Math.min(Math.max(input.limit ?? 120, 1), 300)}
  `;
  return rows.map(toPlannerLearningActivity);
}
