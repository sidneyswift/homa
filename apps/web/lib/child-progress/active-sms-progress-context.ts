import { hashContinuityKey } from "../conversation-continuity/continuity-service";
import { mapDb } from "../map/db";
import { liveProgressEnabled } from "./flag";

export interface ActiveSmsProgressContext {
  checkInId: string;
  deliveryId: string;
}

interface ActiveSmsProgressRow {
  check_in_id: string;
  delivery_id: string;
}

interface ResolveActiveSmsProgressContextInput {
  familyId: string;
  memberUserId: string | null;
  phoneNumber: string;
}

/**
 * Finds the one active progress delivery authenticated by this SMS
 * destination. A resolved conversation loop does not end the workflow, so
 * replied_at is deliberately not part of the lookup.
 */
export async function resolveActiveSmsProgressContextWithDatabase(
  sql: ReturnType<typeof mapDb>,
  input: ResolveActiveSmsProgressContextInput,
): Promise<ActiveSmsProgressContext | null> {
  const destinationHash = hashContinuityKey(
    `sms:${input.phoneNumber.toLowerCase()}`,
  );
  const rows = await sql<ActiveSmsProgressRow[]>`
    select check_in.id as check_in_id,
           delivery.id as delivery_id
    from public.progress_check_ins check_in
    join public.conversation_deliveries delivery
      on delivery.id = check_in.current_delivery_id
     and delivery.family_id = check_in.family_id
    where check_in.family_id = ${input.familyId}
      and check_in.state = 'active'
      and check_in.prompt_recipient_member_user_id
        is not distinct from ${input.memberUserId}::uuid
      and delivery.recipient_member_user_id
        is not distinct from ${input.memberUserId}::uuid
      and delivery.channel = 'sms'
      and delivery.destination_hash = ${destinationHash}
      and delivery.status = 'sent'
    limit 2
  `;
  return rows.length === 1
    ? {
        checkInId: rows[0].check_in_id,
        deliveryId: rows[0].delivery_id,
      }
    : null;
}

export function resolveActiveSmsProgressContext(
  input: ResolveActiveSmsProgressContextInput,
): Promise<ActiveSmsProgressContext | null> {
  if (!liveProgressEnabled()) return Promise.resolve(null);
  return resolveActiveSmsProgressContextWithDatabase(mapDb(), input);
}
