import { mapDb } from "../map/db";
import type { FamilyTaskKind } from "../tasks/kinds";
import { hashContinuityKey } from "./continuity-service";
import {
  replyContractForTask,
  type TaskReplyContract,
} from "./delivery-policy";

export interface FamilyDeliveryRecipient {
  recipientKey: string;
  memberUserId: string | null;
  displayName: string | null;
  phoneNumbers: string[];
  email: string | null;
}

export interface DeliveryEmailIdentity {
  familyId: string;
  memberUserId: string | null;
  memberDisplayName: string | null;
}

export async function findDeliveryEmailIdentity(
  deliveryId: string,
  fromEmail: string,
): Promise<DeliveryEmailIdentity | null> {
  const sql = mapDb();
  const normalized = fromEmail.trim().toLowerCase();
  const rows = await sql<
    {
      family_id: string;
      recipient_member_user_id: string | null;
      display_name: string | null;
    }[]
  >`
    select d.family_id, d.recipient_member_user_id, m.display_name
    from public.conversation_deliveries d
    join public.families f on f.id = d.family_id
    left join public.family_members m
      on m.family_id = d.family_id
     and m.user_id = d.recipient_member_user_id
    left join auth.users u on u.id = d.recipient_member_user_id
    where d.id = ${deliveryId}
      and d.channel = 'email'
      and (
        d.status in ('sent', 'uncertain')
        or (d.status = 'pending' and d.created_at > now() - interval '5 minutes')
      )
      and (
        (d.recipient_member_user_id is not null and lower(u.email) = ${normalized})
        or
        (d.recipient_member_user_id is null and lower(f.email) = ${normalized})
      )
    limit 1
  `;
  const row = rows[0];
  return row
    ? {
        familyId: row.family_id,
        memberUserId: row.recipient_member_user_id,
        memberDisplayName: row.display_name,
      }
    : null;
}

/**
 * Resolves the intended adults at delivery time. Member sign-in emails and
 * attributed phones stay together, so a failed text can fall back to that
 * adult's own email instead of the family-level address by guess.
 */
export async function listFamilyDeliveryRecipients(
  familyId: string,
): Promise<FamilyDeliveryRecipient[]> {
  const sql = mapDb();
  const members = await sql<
    {
      user_id: string;
      display_name: string | null;
      email: string;
      phones: string[];
    }[]
  >`
    select m.user_id, m.display_name, lower(u.email) as email,
           coalesce(
             array_agg(p.phone_e164 order by p.created_at)
               filter (where p.phone_e164 is not null),
             '{}'
           ) as phones
    from public.family_members m
    join auth.users u on u.id = m.user_id
    left join public.family_phones p
      on p.family_id = m.family_id and p.member_user_id = m.user_id
    where m.family_id = ${familyId}
    group by m.user_id, m.display_name, u.email, m.created_at
    order by m.created_at
  `;
  const recipients: FamilyDeliveryRecipient[] = members.map((member) => ({
    recipientKey: `member:${member.user_id}`,
    memberUserId: member.user_id,
    displayName: member.display_name,
    phoneNumbers: member.phones,
    email: member.email,
  }));

  const unattributedPhones = await sql<{ id: string; phone_e164: string }[]>`
    select id, phone_e164 from public.family_phones
    where family_id = ${familyId} and member_user_id is null
    order by created_at
  `;
  for (const phone of unattributedPhones) {
    recipients.push({
      recipientKey: `phone:${phone.id}`,
      memberUserId: null,
      displayName: null,
      phoneNumbers: [phone.phone_e164],
      email: null,
    });
  }

  const familyRows = await sql<{ email: string | null }[]>`
    select lower(email) as email from public.families where id = ${familyId}
  `;
  const familyEmail = familyRows[0]?.email ?? null;
  const memberEmails = new Set(
    recipients.flatMap((recipient) =>
      recipient.email ? [recipient.email] : [],
    ),
  );
  if (familyEmail && !memberEmails.has(familyEmail)) {
    recipients.push({
      recipientKey: `family-email:${hashContinuityKey(familyEmail)}`,
      memberUserId: null,
      displayName: null,
      phoneNumbers: [],
      email: familyEmail,
    });
  }
  return recipients;
}

export interface DeliveryAttempt {
  id: string;
  familyId: string;
  episodeId: string;
  messageId: string;
  taskRunId: string | null;
  memberUserId: string | null;
  channel: "sms" | "email" | "web";
  destination: string;
  providerThreadKey: string | null;
  existingStatus: "pending" | "sent" | "failed" | "uncertain";
  shouldSend: boolean;
  sentAtMs?: number | null;
}

export async function beginDeliveryAttempt(input: {
  familyId: string;
  episodeId: string;
  messageId: string;
  taskRunId: string | null;
  memberUserId: string | null;
  channel: "sms" | "email" | "web";
  destination: string;
  providerThreadKey?: string | null;
}): Promise<DeliveryAttempt> {
  const sql = mapDb();
  const destinationHash = hashContinuityKey(
    `${input.channel}:${input.destination.toLowerCase()}`,
  );
  const threadHash = input.providerThreadKey
    ? hashContinuityKey(input.providerThreadKey)
    : null;
  const rows = await sql<
    {
      id: string;
      status: "pending" | "sent" | "failed" | "uncertain";
      sent_at_ms: string | null;
    }[]
  >`
    insert into public.conversation_deliveries
      (family_id, episode_id, message_id, task_run_id,
       recipient_member_user_id, channel, destination_hash,
       provider_thread_key_hash, attempt_count, status)
    values
      (${input.familyId}, ${input.episodeId}, ${input.messageId},
       ${input.taskRunId}, ${input.memberUserId}, ${input.channel},
       ${destinationHash}, ${threadHash}, 1, 'pending')
    on conflict (message_id, channel, destination_hash) do update
    set attempt_count = public.conversation_deliveries.attempt_count + 1,
        status = 'pending', error = null, failed_at = null,
        updated_at = now()
    where public.conversation_deliveries.status = 'failed'
      and public.conversation_deliveries.attempt_count < 3
    returning id, status,
      (extract(epoch from sent_at) * 1000)::text as sent_at_ms
  `;
  const row =
    rows[0] ??
    (
      await sql<
        {
          id: string;
          status: "pending" | "sent" | "failed" | "uncertain";
          sent_at_ms: string | null;
        }[]
      >`
        select id, status,
          (extract(epoch from sent_at) * 1000)::text as sent_at_ms
        from public.conversation_deliveries
        where message_id = ${input.messageId}
          and channel = ${input.channel}
          and destination_hash = ${destinationHash}
        limit 1
      `
    )[0];
  return {
    id: row.id,
    familyId: input.familyId,
    episodeId: input.episodeId,
    messageId: input.messageId,
    taskRunId: input.taskRunId,
    memberUserId: input.memberUserId,
    channel: input.channel,
    destination: input.destination,
    providerThreadKey: input.providerThreadKey ?? null,
    existingStatus: row.status,
    shouldSend: Boolean(rows[0]),
    sentAtMs:
      row.sent_at_ms === null
        ? null
        : Number(row.sent_at_ms),
  };
}

export async function finishDeliveryAttempt(
  attempt: DeliveryAttempt,
  outcome:
    | { delivered: true; providerMessageId?: string | null }
    | { delivered: false; error?: string | null; uncertain?: boolean },
): Promise<void> {
  const sql = mapDb();
  if (outcome.delivered) {
    await sql`
      update public.conversation_deliveries
      set status = 'sent', sent_at = now(), failed_at = null, error = null,
          provider_message_id = coalesce(${outcome.providerMessageId ?? null}, provider_message_id),
          updated_at = now()
      where id = ${attempt.id} and family_id = ${attempt.familyId}
    `;
    return;
  }
  await sql`
    update public.conversation_deliveries
    set status = ${outcome.uncertain ? "uncertain" : "failed"},
        failed_at = now(),
        error = ${outcome.error?.slice(0, 500) ?? "delivery failed"},
        updated_at = now()
    where id = ${attempt.id} and family_id = ${attempt.familyId}
      and status != 'sent'
  `;
  if (!outcome.uncertain) {
    await sql`
      update public.conversation_open_loops
      set state = 'cancelled'
      where delivery_id = ${attempt.id} and state = 'open'
    `;
  }
}

export async function openReplyLoop(input: {
  attempt: DeliveryAttempt;
  contract: TaskReplyContract;
  now?: Date;
}): Promise<void> {
  return openReplyLoopWithDatabase(mapDb(), input);
}

/**
 * Injectable SQL seam used by the disposable PostgreSQL integration harness.
 */
export async function openReplyLoopWithDatabase(
  sql: ReturnType<typeof mapDb>,
  input: {
    attempt: DeliveryAttempt;
    contract: TaskReplyContract;
    now?: Date;
  },
): Promise<void> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(
    now.getTime() + input.contract.expiresAfterMs,
  );
  await sql`
    insert into public.conversation_open_loops
      (family_id, episode_id, message_id, delivery_id, kind, prompt_key,
       expires_at)
    values
      (${input.attempt.familyId}, ${input.attempt.episodeId},
       ${input.attempt.messageId}, ${input.attempt.id},
       ${input.contract.kind}, ${input.contract.promptKey},
       ${expiresAt.toISOString()})
    on conflict (delivery_id) do update
    set kind = excluded.kind,
        prompt_key = excluded.prompt_key,
        state = 'open',
        expires_at = excluded.expires_at,
        resolved_at = null, resolved_by_message_id = null
    where public.conversation_open_loops.state <> 'resolved'
  `;
}

export function replyContractForDeliveredTask(
  kind: FamilyTaskKind,
  text: string,
): TaskReplyContract | null {
  return replyContractForTask(kind, text);
}

export async function setTaskRunRuntimeSession(
  runId: string,
  sessionId: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.homa_task_runs
    set session_id = ${sessionId}
    where id = ${runId}
  `;
}

export interface ReactiveDeliveryRecord {
  attempt: DeliveryAttempt;
  deliveryOutcome: "sent" | "failed";
}

export async function recordReactiveDelivery(input: {
  familyId: string;
  episodeId: string;
  messageId: string;
  memberUserId: string | null;
  channel: "sms" | "email" | "web";
  destination: string;
  providerThreadKey?: string | null;
  providerMessageId?: string | null;
  content: string;
  delivered: boolean;
}): Promise<ReactiveDeliveryRecord> {
  const attempt = await beginDeliveryAttempt({
    familyId: input.familyId,
    episodeId: input.episodeId,
    messageId: input.messageId,
    taskRunId: null,
    memberUserId: input.memberUserId,
    channel: input.channel,
    destination: input.destination,
    providerThreadKey: input.providerThreadKey ?? null,
  });
  if (attempt.shouldSend) {
    await finishDeliveryAttempt(
      attempt,
      input.delivered
        ? { delivered: true, providerMessageId: input.providerMessageId }
        : { delivered: false, error: "reactive delivery failed" },
    );
  }
  return {
    attempt,
    deliveryOutcome:
      input.delivered &&
      (
        attempt.shouldSend ||
        attempt.existingStatus === "sent"
      )
        ? "sent"
        : "failed",
  };
}

export async function markStalePendingDeliveriesUncertain(
  now = new Date(),
): Promise<number> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    update public.conversation_deliveries
    set status = 'uncertain', failed_at = now(),
        error = 'provider submission did not reach a terminal ledger state',
        updated_at = now()
    where status = 'pending'
      and updated_at < ${new Date(now.getTime() - 5 * 60_000).toISOString()}
    returning id
  `;
  return rows.length;
}
