import { mapDb } from "./map/db";
import { emitMapEvent } from "./map/events";

/**
 * Phone-first leads (lead-funnel-plan.md LF-1/LF-2): the server-side
 * write path for public.phone_leads. Every function takes the number
 * from channel auth context (the SMS sender, the voice caller), never
 * from model input; the capture_lead tool passes the SESSION's number.
 *
 * All writes are best-effort from the callers' perspective: losing a
 * lead row must never break a conversation, so callers wrap these in
 * fire-and-forget with a logged error.
 */

export type LeadChannel = "sms" | "voice";

/** Records a contact from an unknown number: first contact inserts the
 * row, repeats bump the count and graduate 'new' to 'engaged'. Returns
 * whether this was the number's first-ever contact, so the SMS channel
 * can greet a brand-new number with Homa's contact card. */
export async function recordLeadContact(
  phoneE164: string,
  channel: LeadChannel,
): Promise<{ firstContact: boolean }> {
  const sql = mapDb();
  const rows = await sql<{ inserted: boolean }[]>`
    insert into public.phone_leads (phone_e164, first_channel)
    values (${phoneE164}, ${channel})
    on conflict (phone_e164) do update set
      contact_count = phone_leads.contact_count + 1,
      last_contact_at = now(),
      status = case when phone_leads.status = 'new' then 'engaged' else phone_leads.status end
    returning (xmax = 0) as inserted
  `;
  const firstContact = rows[0]?.inserted === true;
  if (firstContact) {
    await emitMapEvent("lead.captured", { channel });
  }
  return { firstContact };
}

/** Enriches the lead conversationally (the capture_lead tool): details
 * she volunteered, and optionally the 'invited' mark when the signup
 * link went out. */
export async function updatePhoneLead(input: {
  phoneE164: string;
  name?: string | null;
  email?: string | null;
  note?: string | null;
  invited?: boolean;
  channel: LeadChannel;
}): Promise<{ saved: boolean }> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    update public.phone_leads set
      name = coalesce(${input.name?.trim().slice(0, 120) || null}, name),
      email = coalesce(${input.email?.trim().toLowerCase().slice(0, 254) || null}, email),
      note = coalesce(${input.note?.trim().slice(0, 500) || null}, note),
      status = case
        when status in ('new', 'engaged') and ${input.invited === true} then 'invited'
        else status
      end,
      last_contact_at = now()
    where phone_e164 = ${input.phoneE164} and status <> 'converted'
    returning id
  `;
  if (rows.length > 0 && input.invited) {
    await emitMapEvent("lead.invited", { channel: input.channel });
  }
  return { saved: rows.length > 0 };
}

/** Flips the lead converted when this number links to a real family
 * (called from the family_phones write paths). */
export async function markLeadConverted(phoneE164: string): Promise<void> {
  const sql = mapDb();
  const rows = await sql<{ first_channel: LeadChannel }[]>`
    update public.phone_leads
    set status = 'converted', last_contact_at = now()
    where phone_e164 = ${phoneE164} and status <> 'converted'
    returning first_channel
  `;
  if (rows[0]) {
    await emitMapEvent("lead.converted", { channel: rows[0].first_channel });
  }
}
