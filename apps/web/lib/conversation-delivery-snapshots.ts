import { createHash } from "node:crypto";
import type { TransactionSql } from "postgres";

/** Lock both visible timelines in one order before the legacy delivery trigger
 * updates the source owner's head and the new snapshot updates its recipient. */
export async function lockConversationDeliverySnapshotScope(tx: TransactionSql, input: {
  familyId: string; messageId: string; memberUserId: string | null;
}): Promise<void> {
  if (input.memberUserId === null) return;
  const [message] = await tx<{ member_user_id: string | null }[]>`select member_user_id from public.conversation_messages
    where id=${input.messageId} and family_id=${input.familyId} and role='assistant'`;
  if (!message) throw new Error("Conversation delivery source unavailable");
  const adults = [...new Set([input.memberUserId, ...(message.member_user_id ? [message.member_user_id] : [])])].sort();
  const members = await tx<{ user_id: string }[]>`select fm.user_id from public.family_members fm join public.families f on f.id=fm.family_id
    where fm.family_id=${input.familyId} and fm.user_id=any(${adults}::uuid[]) and f.status<>'deleted'
    order by fm.user_id for key share of fm,f`;
  if (!members.some(member => member.user_id === input.memberUserId)) throw new Error("Conversation delivery recipient unavailable");
  await tx`insert into public.conversation_records(family_id,member_user_id)
    select ${input.familyId},value from unnest(${members.map(member => member.user_id)}::uuid[]) value order by value
    on conflict(family_id,member_user_id) do nothing`;
  await tx`select id from public.conversation_records where family_id=${input.familyId} and member_user_id=any(${adults}::uuid[])
    order by id for update`;
}

/** Called only with the sender's exact outbound text in the same transaction
 * that first admits its delivery attempt. Never copy current canonical content
 * on acknowledgement or backfill an already-sent legacy receipt. */
export async function prepareConversationDeliverySnapshot(tx: TransactionSql, input: {
  deliveryId: string; familyId: string; messageId: string; memberUserId: string | null;
  channel: "sms" | "email" | "web"; content: string;
}): Promise<void> {
  if (input.memberUserId === null) return;
  if (input.content.includes("\0") || !input.content.isWellFormed()) throw new Error("Invalid outbound conversation text");
  const hash = createHash("sha256").update(input.content).digest("hex");
  const [existing] = await tx<{ content_hash: string; recipient_member_user_id: string; source_message_id: string;
    access_epoch: string; current_epoch: string }[]>`
    select s.content_hash,s.recipient_member_user_id,s.source_message_id,s.access_epoch,c.access_epoch as current_epoch
    from public.conversation_delivery_snapshots s join public.conversation_records c on c.id=s.conversation_id
    where s.delivery_id=${input.deliveryId}`;
  if (existing) {
    if (existing.access_epoch !== existing.current_epoch) throw new Error("Conversation delivery recipient unavailable");
    if (existing.content_hash !== hash || existing.recipient_member_user_id !== input.memberUserId || existing.source_message_id !== input.messageId) {
      throw new Error("Conflicting outbound conversation snapshot");
    }
    return;
  }
  // All values originate from authenticated sender routing. The join verifies
  // the exact receipt and current adult rather than inferring ownership from a
  // destination string, another adult's session or the family-level email.
  await tx`insert into public.conversation_records(family_id,member_user_id)
    select fm.family_id,fm.user_id from public.family_members fm join public.families f on f.id=fm.family_id
    where fm.family_id=${input.familyId} and fm.user_id=${input.memberUserId} and f.status<>'deleted'
    on conflict(family_id,member_user_id) do nothing`;
  const rows = await tx`insert into public.conversation_delivery_snapshots
    (delivery_id,conversation_id,family_id,recipient_member_user_id,access_epoch,source_message_id,channel,content,content_hash)
    select d.id,c.id,d.family_id,d.recipient_member_user_id,c.access_epoch,d.message_id,d.channel,${input.content},${hash}
    from public.conversation_deliveries d
    join public.conversation_records c on c.family_id=d.family_id and c.member_user_id=d.recipient_member_user_id
    join public.family_members fm on fm.family_id=c.family_id and fm.user_id=c.member_user_id
    join public.families f on f.id=c.family_id
    where d.id=${input.deliveryId} and d.family_id=${input.familyId} and d.recipient_member_user_id=${input.memberUserId}
      and d.message_id=${input.messageId} and d.channel=${input.channel} and d.status='pending' and f.status<>'deleted'
    returning id`;
  if (rows.length !== 1) throw new Error("Conversation delivery recipient unavailable");
}
