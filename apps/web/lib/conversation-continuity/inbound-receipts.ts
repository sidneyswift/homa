import { mapDb } from "../map/db";
import { mayClaimInboundReceipt } from "./inbound-receipt-policy";

export interface InboundReceiptClaim {
  id: string;
  claimed: boolean;
}

export async function claimInboundReceipt(input: {
  familyId: string | null;
  channel: "sms" | "email";
  providerMessageId: string;
  now?: Date;
}): Promise<InboundReceiptClaim> {
  const sql = mapDb();
  const now = input.now ?? new Date();
  return await sql.begin(async (tx) => {
    const inserted = await tx<{ id: string }[]>`
      insert into public.conversation_inbound_receipts
        (family_id, channel, provider_message_id, claimed_at)
      values
        (${input.familyId}, ${input.channel}, ${input.providerMessageId},
         ${now.toISOString()})
      on conflict (channel, provider_message_id) do nothing
      returning id
    `;
    if (inserted[0]) return { id: inserted[0].id, claimed: true };

    const existing = await tx<
      { id: string; status: "claimed" | "completed" | "failed"; claimed_at: string }[]
    >`
      select id, status, claimed_at::text as claimed_at
      from public.conversation_inbound_receipts
      where channel = ${input.channel}
        and provider_message_id = ${input.providerMessageId}
      for update
    `;
    const row = existing[0];
    if (
      !row ||
      !mayClaimInboundReceipt(
        { status: row.status, claimedAt: new Date(row.claimed_at) },
        now,
      )
    ) {
      return { id: row?.id ?? "", claimed: false };
    }
    const reclaimed = await tx<{ id: string }[]>`
      update public.conversation_inbound_receipts
      set family_id = ${input.familyId}, status = 'claimed',
          claimed_at = ${now.toISOString()}, completed_at = null,
          failed_at = null, error = null, updated_at = now()
      where id = ${row.id}
        and (
          status = 'failed'
          or (status = 'claimed' and claimed_at < ${new Date(now.getTime() - 30 * 60_000).toISOString()})
        )
      returning id
    `;
    return {
      id: row.id,
      claimed: Boolean(reclaimed[0]),
    };
  });
}

export async function setInboundReceiptSession(
  receiptId: string,
  sessionId: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.conversation_inbound_receipts
    set runtime_session_id = ${sessionId}, updated_at = now()
    where id = ${receiptId} and status = 'claimed'
  `;
}

export async function completeInboundReceipt(receiptId: string): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.conversation_inbound_receipts
    set status = 'completed', completed_at = now(), updated_at = now()
    where id = ${receiptId} and status = 'claimed'
  `;
}

export async function failInboundReceipt(
  receiptId: string,
  error: unknown,
): Promise<void> {
  const sql = mapDb();
  const message =
    error instanceof Error ? error.message.slice(0, 500) : "unknown error";
  await sql`
    update public.conversation_inbound_receipts
    set status = 'failed', failed_at = now(), error = ${message},
        updated_at = now()
    where id = ${receiptId} and status = 'claimed'
  `;
}
