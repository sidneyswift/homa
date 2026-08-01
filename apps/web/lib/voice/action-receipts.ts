import { z } from "zod";

import { mapDb, type DbJson } from "../map/db";

export const VOICE_ACTION_UNDO_WINDOW_MS = 10 * 60 * 1000;
export const VOICE_ACTION_AMBIGUITY_MS = 5_000;

export const voiceActionEffectSchema = z.enum([
  "hours.logged",
  "family_event.added",
  "family_event.updated",
  "family_event.removed",
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
});

const hoursSnapshotSchema = z.object({
  childId: z.string().uuid().nullable(),
  subject: z.string().min(1).max(80),
  minutes: z.number().int().min(1).max(600),
  happenedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  source: z.string().min(1).max(32),
  note: z.string().max(200).nullable(),
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
]);
export type VoiceActionCompensatorPayload = z.infer<typeof receiptPayloadSchema>;

export interface VoiceActionReceipt {
  id: string;
  familyId: string;
  actorUserId: string;
  runtimeSessionId: string;
  turnId: string;
  objectKind: "hours_entry" | "family_event";
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
  object_kind: "hours_entry" | "family_event";
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
  const actor = z.string().uuid().safeParse(attributes.memberUserId);
  if (attributes.messageModality !== "voice" || !actor.success) return null;
  if (
    input.runtimeSessionId.length === 0 || input.runtimeSessionId.length > 200
    || input.turnId.length === 0 || input.turnId.length > 200
  ) {
    return null;
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
): Promise<VoiceActionReceipt> {
  const sql = mapDb();
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + VOICE_ACTION_UNDO_WINDOW_MS);
  const payload = receiptPayloadSchema.parse(input.payload);
  if (payload.effect !== input.effect) {
    throw new TypeError("Voice action receipt effect and compensator do not match");
  }
  const rows = await sql<RawReceiptRow[]>`
    insert into public.voice_action_receipts
      (family_id, actor_user_id, runtime_session_id, turn_id, object_kind,
       object_id, effect, named_effect, undo_capability,
       compensator_payload, created_at, expires_at)
    values
      (${input.familyId}, ${input.actorUserId}, ${input.runtimeSessionId},
       ${input.turnId}, ${input.objectKind}, ${input.objectId}, ${input.effect},
       ${input.namedEffect.slice(0, 240)}, ${input.undoCapability},
       ${sql.json(payload as DbJson)}, ${now.toISOString()}, ${expiresAt.toISOString()})
    on conflict (family_id, runtime_session_id, turn_id, effect, object_id)
    do update set
      named_effect = case
        when voice_action_receipts.status in ('pending', 'cancelled')
          and voice_action_receipts.undone_at is null
        then excluded.named_effect else voice_action_receipts.named_effect end,
      undo_capability = case
        when voice_action_receipts.status in ('pending', 'cancelled')
          and voice_action_receipts.undone_at is null
        then excluded.undo_capability else voice_action_receipts.undo_capability end,
      compensator_payload = case
        when voice_action_receipts.status in ('pending', 'cancelled')
          and voice_action_receipts.undone_at is null
        then excluded.compensator_payload else voice_action_receipts.compensator_payload end,
      status = case
        when voice_action_receipts.status = 'cancelled'
          and voice_action_receipts.undone_at is null
        then 'pending' else voice_action_receipts.status end,
      created_at = case
        when voice_action_receipts.status in ('pending', 'cancelled')
          and voice_action_receipts.undone_at is null
        then excluded.created_at else voice_action_receipts.created_at end,
      expires_at = case
        when voice_action_receipts.status in ('pending', 'cancelled')
          and voice_action_receipts.undone_at is null
        then excluded.expires_at else voice_action_receipts.expires_at end
    where voice_action_receipts.actor_user_id = excluded.actor_user_id
    returning id, family_id, actor_user_id, runtime_session_id, turn_id,
              object_kind, object_id, effect, named_effect, undo_capability,
              compensator_payload, status, created_at::text, expires_at::text,
              undone_at::text
  `;
  if (!rows[0]) {
    throw new Error("Voice action receipt could not be armed for this actor");
  }
  return publicReceipt(rows[0]);
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

/** Arm the server receipt before the domain write. Only committed receipts
 * are selectable by undo. Failed or interrupted mutations leave a pending or
 * cancelled row that Voice cannot choose. */
export async function armVoiceActionThenMutate<T>(input: {
  familyId: string;
  record: () => Promise<VoiceActionReceipt>;
  mutate: () => Promise<T>;
  replay: (receipt: VoiceActionReceipt) => Promise<T>;
  succeeded: (result: T) => boolean;
  commit?: (receipt: VoiceActionReceipt) => Promise<VoiceActionReceipt>;
  cancel?: (receipt: VoiceActionReceipt) => Promise<void>;
}): Promise<{ actionReceipt: VoiceActionReceipt; result: T; replayed: boolean }> {
  const actionReceipt = await input.record();
  if (actionReceipt.lifecycleStatus === "committed") {
    return {
      actionReceipt,
      result: await input.replay(actionReceipt),
      replayed: true,
    };
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
      return { status: "not_found", note: "There is no matching action from this Voice session to undo." };
    }
    const selected = rows[0];
    if (selected.undone_at) {
      return { status: "undone", receipt: publicReceipt(selected), alreadyUndone: true };
    }
    if (new Date(selected.expires_at).getTime() <= now.getTime()) {
      return { status: "expired", note: "That action is outside the ten-minute Voice undo window." };
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
            and note is not distinct from ${after.note}
          returning id
        `;
        if (removed.length === 0) {
          return { status: "not_undoable", note: "That hours entry changed elsewhere, so Homa left the record alone." };
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
          returning id
        `;
        if (removed.length === 0) {
          return { status: "not_undoable", note: "That calendar event changed elsewhere, so Homa left the calendar alone." };
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
              note = ${before.note}
          where id = ${selected.object_id} and family_id = ${input.familyId}
            and child_id is not distinct from ${after.childId}
            and title = ${after.title} and starts_on = ${after.startsOn}
            and ends_on = ${after.endsOn}
            and start_time is not distinct from ${after.startTime}
            and end_time is not distinct from ${after.endTime}
            and note is not distinct from ${after.note}
          returning id
        `;
        if (restored.length === 0) {
          return { status: "not_undoable", note: "That calendar event is no longer there, so Homa did not recreate it silently." };
        }
        break;
      }
      case "family_event.removed": {
        const before = payload.before;
        const restored = await tx<{ id: string }[]>`
          insert into public.family_events
            (id, family_id, child_id, title, starts_on, ends_on,
             start_time, end_time, note)
          values
            (${selected.object_id}, ${input.familyId}, ${before.childId},
             ${before.title}, ${before.startsOn}, ${before.endsOn},
             ${before.startTime}, ${before.endTime}, ${before.note})
          on conflict (id) do nothing
          returning id
        `;
        if (restored.length === 0) {
          return { status: "not_undoable", note: "That calendar slot now contains another change, so Homa left it alone." };
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
