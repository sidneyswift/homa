import { z } from "zod";
import { hoursCategoryNameSchema } from "../hours-categories";
import type { TransactionSql } from "postgres";

import { HOURS_SUBJECTS } from "../hours-model";
import { mapDb, type DbJson } from "../map/db";
import { PLANNER_LEARNING_SOURCE_CHANNELS } from "../planner-learning-activities";
import { captureLoopReceiptLockKey } from "../capture-loop-locks";

export const VOICE_ACTION_UNDO_WINDOW_MS = 10 * 60 * 1000;
export const VOICE_ACTION_AMBIGUITY_MS = 5_000;

export const voiceActionEffectSchema = z.enum([
  "hours.logged",
  "family_event.added",
  "family_event.updated",
  "family_event.removed",
  "plan_activity.scheduled",
  "plan_activity.completed",
  "planner_activity.recorded",
  "planner_activity.completed",
  "task.created",
  "task.updated",
  "task.deleted",
]);
export type VoiceActionEffect = z.infer<typeof voiceActionEffectSchema>;

export const voiceUndoCapabilitySchema = z.enum([
  "exact_delete",
  "exact_restore",
  "append_only_restore",
]);
export type VoiceUndoCapability = z.infer<typeof voiceUndoCapabilitySchema>;

const familyEventSnapshotSchema = z.object({
  childId: z.string().uuid().nullable(),
  title: z.string().min(1).max(200),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u).nullable(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u).nullable(),
  note: z.string().max(500).nullable(),
  recurrence: z.object({
    frequency: z.literal("weekly"),
    interval: z.number().int().min(1).max(52),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable(),
  }).nullable().optional(),
});

const hoursSnapshotSchema = z.object({
  // Legacy receipts without a category only match rows whose category is null.
  customLabel: hoursCategoryNameSchema.nullable().optional(),
  childId: z.string().uuid().nullable(),
  subject: z.string().min(1).max(80),
  minutes: z.number().int().min(1).max(600),
  happenedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  source: z.string().min(1).max(32),
  note: z.string().max(200).nullable(),
});

const linkedHoursSnapshotSchema = hoursSnapshotSchema.extend({
  id: z.string().uuid(),
});

const plannerActivityIdentitySchema = z.object({
  title: z.string().min(1).max(300),
  subject: z.enum(HOURS_SUBJECTS),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  note: z.string().max(500).nullable(),
  sourceChannel: z.enum(PLANNER_LEARNING_SOURCE_CHANNELS),
  sourceQuote: z.string().min(1).max(1000),
  // Null for an item from her schedule, a program, or the Planner screen:
  // no chat message created it. Undo compares it like any other field, so
  // null matches null. Requiring it refused every spoken check-off of a
  // scheduled item (gh#1239: 48 refusals for one family in two weeks).
  sourceMessageId: z.string().uuid().nullable(),
  childIds: z.array(z.string().uuid()).max(12),
});

const plannerActivityRecordedSnapshotSchema = plannerActivityIdentitySchema.extend({
  status: z.enum(["planned", "completed"]),
  durationMinutes: z.number().int().min(1).max(600).nullable(),
  idempotencyKey: z.string().min(16).max(200),
  hours: z.array(linkedHoursSnapshotSchema).max(12),
});

const plannerActivityCompletedSnapshotSchema = plannerActivityIdentitySchema.extend({
  durationMinutes: z.number().int().min(1).max(600).nullable(),
  completionSourceChannel: z.enum(PLANNER_LEARNING_SOURCE_CHANNELS),
  completionSourceQuote: z.string().min(1).max(1000),
  completionSourceMessageId: z.string().uuid(),
  completionIdempotencyKey: z.string().min(16).max(200),
  hours: z.array(linkedHoursSnapshotSchema).max(12),
});

const generatedPlanCompletionSnapshotSchema = z.object({
  childId: z.string().uuid(),
  subjectId: z.string().min(1).max(80),
  week: z.number().int().min(1).max(4),
  activityIndex: z.number().int().min(0).max(999),
  expectedText: z.string().min(1).max(4000),
  planRevision: z.number().int().min(1),
  progressKey: z.string().regex(/^[1-4]\.(0|[1-9][0-9]{0,2})$/u),
  beforeProgressRevision: z.number().int().min(0),
  beforeValue: z.boolean().nullable(),
  afterProgressRevision: z.number().int().min(1),
  hours: z.array(linkedHoursSnapshotSchema).max(1),
});

const planActivitySnapshotSchema = z.object({
  childId: z.string().uuid(),
  subjectId: z.string().min(1).max(80),
  week: z.number().int().min(1).max(4),
  activityIndex: z.number().int().min(0),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
});

const taskSnapshotSchema = z.object({
  kind: z.enum(["journal_prompt", "morning_brief", "custom"]),
  label: z.string().max(60).nullable(),
  prompt: z.string().max(1000).nullable(),
  localHour: z.number().int().min(0).max(23),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  deliveryPref: z.enum(["text", "email", "none"]),
  paused: z.boolean(),
  pausedAt: z.string().nullable(),
  enabled: z.boolean(),
  nextRunAt: z.string().nullable(),
  lastRunAt: z.string().nullable(),
  createdBy: z.enum(["system", "parent", "homa"]),
  recipientMemberUserId: z.string().uuid().nullable(),
  sourceOfferDeliveryId: z.string().uuid().nullable(),
  createdAt: z.string().nullable(),
});

const receiptPayloadSchema = z.discriminatedUnion("effect", [
  z.object({ effect: z.literal("hours.logged"), after: hoursSnapshotSchema }),
  z.object({
    effect: z.literal("family_event.added"),
    after: familyEventSnapshotSchema,
  }),
  z.object({
    effect: z.literal("family_event.updated"),
    before: familyEventSnapshotSchema,
    after: familyEventSnapshotSchema,
  }),
  z.object({
    effect: z.literal("family_event.removed"),
    before: familyEventSnapshotSchema,
  }),
  z.object({
    effect: z.literal("plan_activity.scheduled"),
    before: planActivitySnapshotSchema.nullable(),
    after: planActivitySnapshotSchema,
  }),
  z.object({
    effect: z.literal("plan_activity.completed"),
    completion: generatedPlanCompletionSnapshotSchema,
  }),
  z.object({
    effect: z.literal("planner_activity.recorded"),
    after: plannerActivityRecordedSnapshotSchema,
  }),
  z.object({
    effect: z.literal("planner_activity.completed"),
    beforeStatus: z.literal("planned"),
    after: plannerActivityCompletedSnapshotSchema,
  }),
  z.object({ effect: z.literal("task.created"), after: taskSnapshotSchema }),
  z.object({
    effect: z.literal("task.updated"),
    before: taskSnapshotSchema,
    after: taskSnapshotSchema,
  }),
  z.object({ effect: z.literal("task.deleted"), before: taskSnapshotSchema }),
]);
export type VoiceActionCompensatorPayload = z.infer<typeof receiptPayloadSchema>;

export interface VoiceActionReceipt {
  id: string;
  familyId: string;
  actorUserId: string;
  runtimeSessionId: string;
  turnId: string;
  objectKind: "hours_entry" | "family_event" | "plan_activity" | "task";
  objectId: string;
  effect: VoiceActionEffect;
  namedEffect: string;
  undoCapability: VoiceUndoCapability;
  lifecycleStatus: "pending" | "committed" | "cancelled";
  createdAt: string;
  expiresAt: string;
  undoneAt: string | null;
}

interface RawReceiptRow {
  id: string;
  family_id: string;
  actor_user_id: string;
  runtime_session_id: string;
  turn_id: string;
  object_kind: "hours_entry" | "family_event" | "plan_activity" | "task";
  object_id: string;
  effect: VoiceActionEffect;
  named_effect: string;
  undo_capability: VoiceUndoCapability;
  compensator_payload: unknown;
  status: "pending" | "committed" | "cancelled";
  created_at: string;
  expires_at: string;
  undone_at: string | null;
}

function publicReceipt(row: RawReceiptRow): VoiceActionReceipt {
  return {
    id: row.id,
    familyId: row.family_id,
    actorUserId: row.actor_user_id,
    runtimeSessionId: row.runtime_session_id,
    turnId: row.turn_id,
    objectKind: row.object_kind,
    objectId: row.object_id,
    effect: row.effect,
    namedEffect: row.named_effect,
    undoCapability: row.undo_capability,
    lifecycleStatus: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    undoneAt: row.undone_at,
  };
}

export interface RecordVoiceActionInput {
  familyId: string;
  actorUserId: string;
  runtimeSessionId: string;
  turnId: string;
  objectKind: VoiceActionReceipt["objectKind"];
  objectId: string;
  effect: VoiceActionEffect;
  namedEffect: string;
  undoCapability: VoiceUndoCapability;
  payload: VoiceActionCompensatorPayload;
  now?: Date;
}

export interface VoiceActionArming {
  receipt: VoiceActionReceipt;
  disposition: "acquired" | "existing";
}

export interface VoiceToolReceiptContext {
  familyId: string;
  actorUserId: string;
  runtimeSessionId: string;
  turnId: string;
}

/**
 * Receipts are only minted for a trusted native Voice bridge turn. The
 * modality and adult id come from Eve auth attributes, never tool input.
 */
export function voiceToolReceiptContext(input: {
  familyId: string;
  attributes: unknown;
  runtimeSessionId: string;
  turnId: string;
}): VoiceToolReceiptContext | null {
  const attributes = (input.attributes ?? {}) as {
    memberUserId?: unknown;
    messageModality?: unknown;
  };
  if (attributes.messageModality !== "voice") return null;

  const actor = z.string().uuid().safeParse(attributes.memberUserId);
  if (!actor.success) {
    throw new Error(
      "Voice changes require a signed-in adult. Nothing was changed. Reopen Voice from the signed-in Homa app and try again.",
    );
  }
  if (
    input.runtimeSessionId.length === 0 || input.runtimeSessionId.length > 200
    || input.turnId.length === 0 || input.turnId.length > 200
  ) {
    throw new Error(
      "Voice could not prove which conversation made this change. Nothing was changed. Reopen Voice and try again.",
    );
  }
  return {
    familyId: input.familyId,
    actorUserId: actor.data,
    runtimeSessionId: input.runtimeSessionId,
    turnId: input.turnId,
  };
}

export async function recordVoiceAction(
  input: RecordVoiceActionInput,
): Promise<VoiceActionArming> {
  const sql = mapDb();
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + VOICE_ACTION_UNDO_WINDOW_MS);
  const payload = receiptPayloadSchema.parse(input.payload);
  if (payload.effect !== input.effect) {
    throw new TypeError("Voice action receipt effect and compensator do not match");
  }
  const lockKey = JSON.stringify([
    input.familyId,
    input.runtimeSessionId,
    input.turnId,
    input.effect,
    input.objectId,
  ]);
  return await sql.begin(async (tx): Promise<VoiceActionArming> => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const existing = await tx<RawReceiptRow[]>`
      select id, family_id, actor_user_id, runtime_session_id, turn_id,
             object_kind, object_id, effect, named_effect, undo_capability,
             compensator_payload, status, created_at::text, expires_at::text,
             undone_at::text
      from public.voice_action_receipts
      where family_id = ${input.familyId}
        and runtime_session_id = ${input.runtimeSessionId}
        and turn_id = ${input.turnId}
        and effect = ${input.effect}
        and object_id = ${input.objectId}
      limit 1
    `;
    if (existing[0]) {
      if (existing[0].actor_user_id !== input.actorUserId) {
        throw new Error("Voice action receipt could not be armed for this actor");
      }
      return { receipt: publicReceipt(existing[0]), disposition: "existing" };
    }
    const rows = await tx<RawReceiptRow[]>`
      insert into public.voice_action_receipts
        (family_id, actor_user_id, runtime_session_id, turn_id, object_kind,
         object_id, effect, named_effect, undo_capability,
         compensator_payload, created_at, expires_at)
      values
        (${input.familyId}, ${input.actorUserId}, ${input.runtimeSessionId},
         ${input.turnId}, ${input.objectKind}, ${input.objectId}, ${input.effect},
         ${input.namedEffect.slice(0, 240)}, ${input.undoCapability},
         ${tx.json(payload as DbJson)}, ${now.toISOString()}, ${expiresAt.toISOString()})
      returning id, family_id, actor_user_id, runtime_session_id, turn_id,
                object_kind, object_id, effect, named_effect, undo_capability,
                compensator_payload, status, created_at::text, expires_at::text,
                undone_at::text
    `;
    if (!rows[0]) {
      throw new Error("Voice action receipt could not be armed for this actor");
    }
    return { receipt: publicReceipt(rows[0]), disposition: "acquired" };
  });
}

export async function commitVoiceAction(input: {
  familyId: string;
  receiptId: string;
}): Promise<VoiceActionReceipt> {
  const sql = mapDb();
  const rows = await sql<RawReceiptRow[]>`
    update public.voice_action_receipts
    set status = 'committed'
    where id = ${input.receiptId} and family_id = ${input.familyId}
      and status = 'pending' and undone_at is null
    returning id, family_id, actor_user_id, runtime_session_id, turn_id,
              object_kind, object_id, effect, named_effect, undo_capability,
              compensator_payload, status, created_at::text, expires_at::text,
              undone_at::text
  `;
  if (!rows[0]) {
    throw new Error("Voice action receipt could not be committed");
  }
  return publicReceipt(rows[0]);
}

export async function cancelVoiceAction(input: {
  familyId: string;
  receiptId: string;
}): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.voice_action_receipts
    set status = 'cancelled'
    where id = ${input.receiptId} and family_id = ${input.familyId}
      and status = 'pending' and undone_at is null
  `;
}

/** Arm the server receipt before the domain write. Only the caller that
 * acquired the durable lease may mutate. Only committed receipts are
 * selectable by undo; failed or interrupted rows cannot be chosen. */
export async function armVoiceActionThenMutate<T>(input: {
  familyId: string;
  record: () => Promise<VoiceActionArming>;
  mutate: () => Promise<T>;
  replay: (receipt: VoiceActionReceipt) => Promise<T>;
  succeeded: (result: T) => boolean;
  commit?: (receipt: VoiceActionReceipt) => Promise<VoiceActionReceipt>;
  cancel?: (receipt: VoiceActionReceipt) => Promise<void>;
}): Promise<{ actionReceipt: VoiceActionReceipt; result: T; replayed: boolean }> {
  const arming = await input.record();
  const actionReceipt = arming.receipt;
  if (actionReceipt.lifecycleStatus === "committed") {
    return {
      actionReceipt,
      result: await input.replay(actionReceipt),
      replayed: true,
    };
  }
  if (arming.disposition !== "acquired") {
    throw new Error("Voice action is already in progress or did not complete");
  }
  if (actionReceipt.lifecycleStatus !== "pending") {
    throw new Error("Voice action receipt is not armed");
  }
  const cancel = input.cancel ?? ((receipt: VoiceActionReceipt) =>
    cancelVoiceAction({ familyId: input.familyId, receiptId: receipt.id }));
  try {
    const result = await input.mutate();
    if (!input.succeeded(result)) {
      await cancel(actionReceipt);
      return { actionReceipt, result, replayed: false };
    }
    const committed = input.commit
      ? await input.commit(actionReceipt)
      : await commitVoiceAction({
          familyId: input.familyId,
          receiptId: actionReceipt.id,
        });
    return { actionReceipt: committed, result, replayed: false };
  } catch (error) {
    try {
      await cancel(actionReceipt);
    } catch {
      // A pending receipt is never selectable, even when cancellation fails.
    }
    throw error;
  }
}

export function voiceActionCandidatesAreAmbiguous(
  first: Pick<VoiceActionReceipt, "turnId" | "createdAt">,
  second: Pick<VoiceActionReceipt, "turnId" | "createdAt"> | undefined,
): boolean {
  if (!second) return false;
  if (first.turnId === second.turnId) return true;
  return Math.abs(
    new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
  ) <= VOICE_ACTION_AMBIGUITY_MS;
}

type LinkedHoursSnapshot = z.infer<typeof linkedHoursSnapshotSchema>;
type PlannerActivityIdentitySnapshot = z.infer<typeof plannerActivityIdentitySchema>;

interface StoredHoursRow {
  id: string;
  custom_label: string | null;
  child_id: string | null;
  subject: string;
  minutes: number;
  happened_on: string;
  source: string;
  note: string | null;
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify([...new Set(left)].sort())
    === JSON.stringify([...new Set(right)].sort());
}

function sameHoursRows(
  rows: readonly StoredHoursRow[],
  snapshots: readonly LinkedHoursSnapshot[],
): boolean {
  if (rows.length !== snapshots.length) return false;
  const expected = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return rows.every((row) => {
    const snapshot = expected.get(row.id);
    return snapshot !== undefined
      && row.child_id === snapshot.childId
      && row.subject === snapshot.subject
      && row.minutes === snapshot.minutes
      && row.happened_on === snapshot.happenedOn
      && row.source === snapshot.source
      && row.note === snapshot.note
      && row.custom_label === (snapshot.customLabel ?? null);
  });
}

interface StoredPlannerActivityRow {
  id: string;
  title: string;
  subject: string;
  activity_date: string;
  status: "planned" | "completed";
  duration_minutes: number | null;
  note: string | null;
  source_channel: string;
  source_quote: string;
  source_message_id: string | null;
  idempotency_key: string;
  completion_source_channel: string | null;
  completion_source_quote: string | null;
  completion_source_message_id: string | null;
  completion_idempotency_key: string | null;
}

async function lockPlannerReceiptState(input: {
  tx: TransactionSql;
  familyId: string;
  activityId: string;
  expectedHours: readonly LinkedHoursSnapshot[];
}): Promise<{
  activity: StoredPlannerActivityRow;
  childIds: string[];
  hoursMatch: boolean;
} | null> {
  const activityRows = await input.tx<StoredPlannerActivityRow[]>`
    select id, title, subject, activity_date::text, status,
           duration_minutes, note, source_channel, source_quote,
           source_message_id, idempotency_key,
           completion_source_channel, completion_source_quote,
           completion_source_message_id, completion_idempotency_key
    from public.planner_learning_activities
    where id = ${input.activityId} and family_id = ${input.familyId}
    for update
  `;
  const activity = activityRows[0];
  if (!activity) return null;

  const childRows = await input.tx<{ child_id: string }[]>`
    select child_id
    from public.planner_learning_activity_children
    where activity_id = ${input.activityId} and family_id = ${input.familyId}
    order by child_id
    for update
  `;
  const expectedHoursIds = input.expectedHours.map((hour) => hour.id);
  const linkRows = await input.tx<Array<{
    activity_id: string;
    hours_entry_id: string;
  }>>`
    select activity_id, hours_entry_id
    from public.planner_learning_activity_hours
    where family_id = ${input.familyId}
      and (
        activity_id = ${input.activityId}
        or hours_entry_id = any(${input.tx.array(expectedHoursIds)}::uuid[])
      )
    order by activity_id, hours_entry_id
    for update
  `;
  const expectedLinks = expectedHoursIds
    .map((hoursEntryId) => `${input.activityId}:${hoursEntryId}`);
  const actualLinks = linkRows
    .map((link) => `${link.activity_id}:${link.hours_entry_id}`);
  const hoursRows = expectedHoursIds.length === 0
    ? []
    : await input.tx<StoredHoursRow[]>`
        select id, child_id, subject, custom_label, minutes, happened_on::text,
               source, note
        from public.hours_log
        where family_id = ${input.familyId}
          and id = any(${input.tx.array(expectedHoursIds)}::uuid[])
        order by id
        for update
      `;
  return {
    activity,
    childIds: childRows.map((row) => row.child_id),
    hoursMatch: sameStringSet(actualLinks, expectedLinks)
      && sameHoursRows(hoursRows, input.expectedHours),
  };
}

function plannerIdentityMatches(
  row: StoredPlannerActivityRow,
  childIds: readonly string[],
  snapshot: PlannerActivityIdentitySnapshot,
): boolean {
  return row.title === snapshot.title
    && row.subject === snapshot.subject
    && row.activity_date === snapshot.activityDate
    && row.note === snapshot.note
    && row.source_channel === snapshot.sourceChannel
    && row.source_quote === snapshot.sourceQuote
    && row.source_message_id === snapshot.sourceMessageId
    && sameStringSet(childIds, snapshot.childIds);
}

export type UndoVoiceActionResult =
  | { status: "undone"; receipt: VoiceActionReceipt; alreadyUndone: boolean }
  | { status: "choose"; candidates: VoiceActionReceipt[] }
  | { status: "expired" | "not_found" | "not_undoable"; note: string };

export async function undoVoiceAction(input: {
  familyId: string;
  actorUserId: string;
  runtimeSessionId: string;
  undoTurnId: string;
  receiptId?: string;
  now?: Date;
}): Promise<UndoVoiceActionResult> {
  const sql = mapDb();
  const now = input.now ?? new Date();
  return await sql.begin(async (tx): Promise<UndoVoiceActionResult> => {
    const rows = await tx<RawReceiptRow[]>`
      select id, family_id, actor_user_id, runtime_session_id, turn_id,
             object_kind, object_id, effect, named_effect, undo_capability,
             compensator_payload, status, created_at::text, expires_at::text,
             undone_at::text
      from public.voice_action_receipts
      where family_id = ${input.familyId}
        and actor_user_id = ${input.actorUserId}
        and runtime_session_id = ${input.runtimeSessionId}
        and status = 'committed'
        ${input.receiptId ? tx`and id = ${input.receiptId}` : tx``}
      order by created_at desc
      limit ${input.receiptId ? 1 : 2}
      for update
    `;
    if (rows.length === 0) {
      return {
        status: "not_found",
        note: "Homa could not find a recent action to undo. Nothing changed. Try again from the Voice conversation where you made the change.",
      };
    }
    const selected = rows[0];
    await tx`
      select pg_advisory_xact_lock(
        hashtextextended(
          ${captureLoopReceiptLockKey(input.familyId, selected.id)},
          0
        )
      )
    `;
    if (selected.undone_at) {
      return { status: "undone", receipt: publicReceipt(selected), alreadyUndone: true };
    }
    if (new Date(selected.expires_at).getTime() <= now.getTime()) {
      return {
        status: "expired",
        note: "That action is too old to undo safely. Nothing changed. Open the record to make a correction.",
      };
    }
    if (!input.receiptId && voiceActionCandidatesAreAmbiguous(publicReceipt(selected), rows[1] ? publicReceipt(rows[1]) : undefined)) {
      return { status: "choose", candidates: rows.map(publicReceipt) };
    }

    const payload = receiptPayloadSchema.parse(selected.compensator_payload);
    switch (payload.effect) {
      case "hours.logged": {
        const after = payload.after;
        const removed = await tx<{ id: string }[]>`
          delete from public.hours_log
          where id = ${selected.object_id} and family_id = ${input.familyId}
            and child_id is not distinct from ${after.childId}
            and subject = ${after.subject} and minutes = ${after.minutes}
            and happened_on = ${after.happenedOn} and source = ${after.source}
            and custom_label is not distinct from ${after.customLabel ?? null}
            and note is not distinct from ${after.note}
          returning id
        `;
        if (removed.length === 0) {
          return {
            status: "not_undoable",
            note: "That entry in Hours changed after Homa saved it. Homa kept the newer version. Open Hours to review it.",
          };
        }
        break;
      }
      case "family_event.added": {
        const after = payload.after;
        const removed = await tx<{ id: string }[]>`
          delete from public.family_events
          where id = ${selected.object_id} and family_id = ${input.familyId}
            and child_id is not distinct from ${after.childId}
            and title = ${after.title} and starts_on = ${after.startsOn}
            and ends_on = ${after.endsOn}
            and start_time is not distinct from ${after.startTime}
            and end_time is not distinct from ${after.endTime}
            and note is not distinct from ${after.note}
            and recurrence_rule is not distinct from ${after.recurrence == null ? null : tx.json(after.recurrence as DbJson)}
          returning id
        `;
        if (removed.length === 0) {
          return {
            status: "not_undoable",
            note: "That calendar event changed after Homa added it. Homa kept the newer version. Open the Planner to review it.",
          };
        }
        break;
      }
      case "family_event.updated": {
        const before = payload.before;
        const after = payload.after;
        const restored = await tx<{ id: string }[]>`
          update public.family_events
          set child_id = ${before.childId}, title = ${before.title},
              starts_on = ${before.startsOn}, ends_on = ${before.endsOn},
              start_time = ${before.startTime}, end_time = ${before.endTime},
              note = ${before.note},
              recurrence_rule = ${before.recurrence == null ? null : tx.json(before.recurrence as DbJson)}
          where id = ${selected.object_id} and family_id = ${input.familyId}
            and child_id is not distinct from ${after.childId}
            and title = ${after.title} and starts_on = ${after.startsOn}
            and ends_on = ${after.endsOn}
            and start_time is not distinct from ${after.startTime}
            and end_time is not distinct from ${after.endTime}
            and note is not distinct from ${after.note}
            and recurrence_rule is not distinct from ${after.recurrence == null ? null : tx.json(after.recurrence as DbJson)}
          returning id
        `;
        if (restored.length === 0) {
          return {
            status: "not_undoable",
            note: "That event was removed after Homa changed it. Nothing was recreated. Ask Homa to add it again if you still want it.",
          };
        }
        break;
      }
      case "family_event.removed": {
        const before = payload.before;
        const restored = await tx<{ id: string }[]>`
          insert into public.family_events
            (id, family_id, child_id, title, starts_on, ends_on,
             start_time, end_time, note, recurrence_rule)
          values
            (${selected.object_id}, ${input.familyId}, ${before.childId},
             ${before.title}, ${before.startsOn}, ${before.endsOn},
             ${before.startTime}, ${before.endTime}, ${before.note},
             ${before.recurrence == null ? null : tx.json(before.recurrence as DbJson)})
          on conflict (id) do nothing
          returning id
        `;
        if (restored.length === 0) {
          return {
            status: "not_undoable",
            note: "That event was already restored or replaced. Homa left the current calendar unchanged. Open the Planner to review it.",
          };
        }
        break;
      }
      case "plan_activity.scheduled": {
        const { before, after } = payload;
        if (before === null) {
          const removed = await tx<{ id: string }[]>`
            delete from public.plan_activity_schedule
            where id = ${selected.object_id} and family_id = ${input.familyId}
              and child_id = ${after.childId} and subject_id = ${after.subjectId}
              and week = ${after.week} and activity_index = ${after.activityIndex}
              and scheduled_date = ${after.scheduledDate}
            returning id
          `;
          if (removed.length === 0) {
            return {
              status: "not_undoable",
              note: "That activity moved again after Homa scheduled it. Homa kept the newer date. Open the Planner to review it.",
            };
          }
        } else {
          const restored = await tx<{ id: string }[]>`
            update public.plan_activity_schedule
            set scheduled_date = ${before.scheduledDate}, updated_at = now()
            where id = ${selected.object_id} and family_id = ${input.familyId}
              and child_id = ${after.childId} and subject_id = ${after.subjectId}
              and week = ${after.week} and activity_index = ${after.activityIndex}
              and scheduled_date = ${after.scheduledDate}
            returning id
          `;
          if (restored.length === 0) {
            return {
              status: "not_undoable",
              note: "That activity moved again after Homa scheduled it. Homa kept the newer date. Open the Planner to review it.",
            };
          }
        }
        break;
      }
      case "plan_activity.completed": {
        const completion = payload.completion;
        const planRows = await tx<Array<{
          id: string;
          child_id: string;
          subject_id: string;
          plan: { weeks?: Array<{ week: number; activities: unknown[] }> };
          progress: Record<string, unknown>;
          plan_revision: number;
          progress_revision: number;
        }>>`
          select plan.id, plan.child_id, plan.subject_id, plan.plan,
                 plan.progress, plan.plan_revision::integer as plan_revision,
                 plan.progress_revision::integer as progress_revision
          from public.child_plans plan
          join public.children child
            on child.id = plan.child_id and child.family_id = ${input.familyId}
          where plan.id = ${selected.object_id}
          for update of plan
        `;
        const plan = planRows[0];
        const weeks = Array.isArray(plan?.plan?.weeks) ? plan.plan.weeks : [];
        const matchingWeeks = weeks.filter((week) => week.week === completion.week);
        const actualText = matchingWeeks.length === 1
          && Array.isArray(matchingWeeks[0].activities)
          ? matchingWeeks[0].activities[completion.activityIndex]
          : null;
        const hoursIds = completion.hours.map((hour) => hour.id);
        const hoursRows = hoursIds.length === 0
          ? []
          : await tx<StoredHoursRow[]>`
              select id, child_id, subject, custom_label, minutes, happened_on::text,
                     source, note
              from public.hours_log
              where family_id = ${input.familyId}
                and id = any(${tx.array(hoursIds)}::uuid[])
              order by id
              for update
            `;
        if (
          !plan
          || plan.child_id !== completion.childId
          || plan.subject_id !== completion.subjectId
          || plan.plan_revision !== completion.planRevision
          || plan.progress_revision !== completion.afterProgressRevision
          || actualText !== completion.expectedText
          || plan.progress?.[completion.progressKey] !== true
          || !sameHoursRows(hoursRows, completion.hours)
        ) {
          return {
            status: "not_undoable",
            note: "That plan or its Hours entry changed after Homa marked the activity finished. Homa kept the newer version. Open Planner to review it.",
          };
        }
        const nextProgress = { ...plan.progress };
        if (completion.beforeValue === null) {
          delete nextProgress[completion.progressKey];
        } else {
          nextProgress[completion.progressKey] = completion.beforeValue;
        }
        const restored = await tx<{ id: string }[]>`
          update public.child_plans
          set progress = ${tx.json(nextProgress as DbJson)}, updated_at = now()
          where id = ${plan.id}
            and progress_revision = ${completion.afterProgressRevision}
          returning id
        `;
        if (restored.length === 0) {
          return {
            status: "not_undoable",
            note: "That plan changed while Homa was undoing the check-off. Homa kept the newer version. Open Planner to review it.",
          };
        }
        if (hoursIds.length > 0) {
          const removedHours = await tx<{ id: string }[]>`
            delete from public.hours_log
            where family_id = ${input.familyId}
              and id = any(${tx.array(hoursIds)}::uuid[])
            returning id
          `;
          if (removedHours.length !== hoursIds.length) {
            throw new Error("Planner completion undo lost its locked Hours rows");
          }
        }
        break;
      }
      case "planner_activity.recorded": {
        const after = payload.after;
        const state = await lockPlannerReceiptState({
          tx,
          familyId: input.familyId,
          activityId: selected.object_id,
          expectedHours: after.hours,
        });
        const completionMatches = after.status === "completed"
          ? state?.activity.completion_source_channel === after.sourceChannel
            && state.activity.completion_source_quote === after.sourceQuote
            && state.activity.completion_source_message_id === after.sourceMessageId
            && state.activity.completion_idempotency_key === after.idempotencyKey
          : state?.activity.completion_source_channel === null
            && state.activity.completion_source_quote === null
            && state.activity.completion_source_message_id === null
            && state.activity.completion_idempotency_key === null;
        if (
          !state
          || !plannerIdentityMatches(state.activity, state.childIds, after)
          || state.activity.status !== after.status
          || state.activity.duration_minutes !== after.durationMinutes
          || state.activity.idempotency_key !== after.idempotencyKey
          || !completionMatches
          || !state.hoursMatch
        ) {
          return {
            status: "not_undoable",
            note: "That Planner activity or its Hours entry changed after Homa recorded it. Homa kept the newer version. Open Planner to review it.",
          };
        }
        const removed = await tx<{ id: string }[]>`
          delete from public.planner_learning_activities
          where id = ${selected.object_id} and family_id = ${input.familyId}
          returning id
        `;
        if (removed.length === 0) {
          throw new Error("Planner activity undo lost its locked activity row");
        }
        const hoursIds = after.hours.map((hour) => hour.id);
        if (hoursIds.length > 0) {
          const removedHours = await tx<{ id: string }[]>`
            delete from public.hours_log
            where family_id = ${input.familyId}
              and id = any(${tx.array(hoursIds)}::uuid[])
            returning id
          `;
          if (removedHours.length !== hoursIds.length) {
            throw new Error("Planner activity undo lost its locked Hours rows");
          }
        }
        break;
      }
      case "planner_activity.completed": {
        const after = payload.after;
        const state = await lockPlannerReceiptState({
          tx,
          familyId: input.familyId,
          activityId: selected.object_id,
          expectedHours: after.hours,
        });
        if (
          !state
          || !plannerIdentityMatches(state.activity, state.childIds, after)
          || state.activity.status !== "completed"
          || state.activity.duration_minutes !== after.durationMinutes
          || state.activity.completion_source_channel !== after.completionSourceChannel
          || state.activity.completion_source_quote !== after.completionSourceQuote
          || state.activity.completion_source_message_id !== after.completionSourceMessageId
          || state.activity.completion_idempotency_key !== after.completionIdempotencyKey
          || !state.hoursMatch
        ) {
          return {
            status: "not_undoable",
            note: "That Planner activity or its Hours entry changed after Homa marked it finished. Homa kept the newer version. Open Planner to review it.",
          };
        }
        const hoursIds = after.hours.map((hour) => hour.id);
        await tx`
          delete from public.planner_learning_activity_hours
          where family_id = ${input.familyId}
            and activity_id = ${selected.object_id}
        `;
        if (hoursIds.length > 0) {
          const removedHours = await tx<{ id: string }[]>`
            delete from public.hours_log
            where family_id = ${input.familyId}
              and id = any(${tx.array(hoursIds)}::uuid[])
            returning id
          `;
          if (removedHours.length !== hoursIds.length) {
            throw new Error("Planner activity completion undo lost its locked Hours rows");
          }
        }
        const restored = await tx<{ id: string }[]>`
          update public.planner_learning_activities
          set status = 'planned', duration_minutes = null,
              completion_source_channel = null,
              completion_source_quote = null,
              completion_source_message_id = null,
              completion_idempotency_key = null,
              completed_by_user_id = null,
              completed_at = null,
              updated_at = now()
          where id = ${selected.object_id} and family_id = ${input.familyId}
            and status = 'completed'
          returning id
        `;
        if (restored.length === 0) {
          throw new Error("Planner activity completion undo lost its locked activity row");
        }
        break;
      }
      case "task.created": {
        const after = payload.after;
        const removed = await tx<{ id: string }[]>`
          delete from public.agent_schedules
          where id = ${selected.object_id} and family_id = ${input.familyId}
            and kind = ${after.kind} and label is not distinct from ${after.label}
            and prompt is not distinct from ${after.prompt}
            and local_hour = ${after.localHour}
            and weekdays = ${tx.array(after.weekdays)}::smallint[]
            and delivery_pref = ${after.deliveryPref}
            and paused_at is null and enabled = ${after.enabled}
            and last_run_at is null and created_by = ${after.createdBy}
            and recipient_member_user_id is not distinct from ${after.recipientMemberUserId}
            and source_offer_delivery_id is not distinct from ${after.sourceOfferDeliveryId}
          returning id
        `;
        if (removed.length === 0) {
          return {
            status: "not_undoable",
            note: "That task changed or ran after Homa created it. Homa kept the current task. Open Tasks to review it.",
          };
        }
        break;
      }
      case "task.updated": {
        const { before, after } = payload;
        const restored = await tx<{ id: string }[]>`
          update public.agent_schedules
          set label = ${before.label}, prompt = ${before.prompt},
              local_hour = ${before.localHour},
              weekdays = ${tx.array(before.weekdays)}::smallint[],
              delivery_pref = ${before.deliveryPref},
              paused_at = ${before.pausedAt},
              enabled = ${before.enabled},
              next_run_at = coalesce(${before.nextRunAt}, next_run_at)
          where id = ${selected.object_id} and family_id = ${input.familyId}
            and kind = ${after.kind} and label is not distinct from ${after.label}
            and prompt is not distinct from ${after.prompt}
            and local_hour = ${after.localHour}
            and weekdays = ${tx.array(after.weekdays)}::smallint[]
            and delivery_pref = ${after.deliveryPref}
            and (${after.paused} = (paused_at is not null))
            and enabled = ${after.enabled}
            and last_run_at is not distinct from ${after.lastRunAt}
          returning id
        `;
        if (restored.length === 0) {
          return {
            status: "not_undoable",
            note: "That task changed or ran again after Homa updated it. Homa kept the newer version. Open Tasks to review it.",
          };
        }
        break;
      }
      case "task.deleted": {
        const before = payload.before;
        const restored = await tx<{ id: string }[]>`
          insert into public.agent_schedules
            (id, family_id, kind, next_run_at, last_run_at, enabled, created_at,
             local_hour, weekdays, delivery_pref, label, prompt, created_by,
             paused_at, recipient_member_user_id, source_offer_delivery_id)
          values
            (${selected.object_id}, ${input.familyId}, ${before.kind},
             ${before.nextRunAt}, ${before.lastRunAt}, ${before.enabled},
             coalesce(${before.createdAt}, now()), ${before.localHour},
             ${tx.array(before.weekdays)}::smallint[], ${before.deliveryPref},
             ${before.label}, ${before.prompt}, ${before.createdBy},
             ${before.pausedAt},
             ${before.recipientMemberUserId}, ${before.sourceOfferDeliveryId})
          on conflict (id) do nothing
          returning id
        `;
        if (restored.length === 0) {
          return {
            status: "not_undoable",
            note: "That task was already restored or replaced. Homa left the current task unchanged. Open Tasks to review it.",
          };
        }
        break;
      }
    }
    const stamped = await tx<RawReceiptRow[]>`
      update public.voice_action_receipts
      set undone_at = ${now.toISOString()}, undo_turn_id = ${input.undoTurnId}
      where id = ${selected.id} and family_id = ${input.familyId} and undone_at is null
      returning id, family_id, actor_user_id, runtime_session_id, turn_id,
                object_kind, object_id, effect, named_effect, undo_capability,
                compensator_payload, status, created_at::text, expires_at::text,
                undone_at::text
    `;
    return {
      status: "undone",
      receipt: publicReceipt(stamped[0] ?? { ...selected, undone_at: now.toISOString() }),
      alreadyUndone: stamped.length === 0,
    };
  });
}

export const NON_UNDOABLE_VOICE_EFFECTS = [
  "external_send",
  "completed_print",
  "purchase",
  "state_filing",
  "account_or_destructive_action",
] as const;
