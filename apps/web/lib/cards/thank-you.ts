import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";

import {
  getHandwryttenOrderStatus,
  handwryttenConfigured,
  handwryttenLiveMode,
  isHandwryttenAccountInTestMode,
  isMailedStatus,
  sendHandwryttenCard,
} from "./handwrytten";
import { THANK_YOU_CARD_WISHES, thankYouCardMessage } from "./message";

/**
 * One real handwritten thank-you card per family, ever
 * (plans/2026-07-11-thank-you-cards.md). Runs inside /api/map/cron.
 *
 * Three passes, all idempotent:
 *   1. enqueue: families that finished web onboarding 48+ hours ago with a
 *      complete address get a queued row (unique family_id absorbs re-runs).
 *   2. send: queued rows become Handwrytten orders, throttled by a per-run
 *      batch and a monthly spend cap. Three strikes and a row parks as
 *      "failed" for a human to look at; it never burns money in a loop.
 *   3. confirm: sent rows graduate to "mailed" when the vendor says so.
 *
 * DARK unless THANK_YOU_CARDS_ENABLED="true" AND the Handwrytten env is
 * complete. Flipping it on later is expected to drain the whole eligible
 * backlog (newest signups queue alongside older ones), bounded by the cap.
 */

/** Sends per cron run (hourly). ONE on purpose, not just a velocity
 *  brake: each order charges the card on file for the same amount, and
 *  the payment processor's duplicate-transaction window declines
 *  same-amount charges placed seconds apart ("Can't get transaction id
 *  with card payment", first live sweep 2026-07-11: card 1 and 3
 *  declined around card 2's success). One per hourly run keeps every
 *  charge well outside the window; a backlog drains itself in a day. */
const SEND_BATCH_LIMIT = 1;
const MAX_SEND_ATTEMPTS = 3;
const DEFAULT_MONTHLY_CAP = 150;
const STALE_PROCESSING_MINUTES = 30;

export interface ThankYouCardSweepResult {
  skipped: boolean;
  enqueued: number;
  sent: number;
  mailed: number;
  failed: number;
}

export async function sweepThankYouCards(): Promise<ThankYouCardSweepResult> {
  const result: ThankYouCardSweepResult = {
    skipped: true,
    enqueued: 0,
    sent: 0,
    mailed: 0,
    failed: 0,
  };
  if (process.env.THANK_YOU_CARDS_ENABLED !== "true" || !handwryttenConfigured()) {
    return result;
  }
  if (!handwryttenLiveMode()) {
    // Refuse to sweep in test mode rather than burn once-ever rows on
    // orders that never mail; see handwryttenLiveMode().
    console.error(
      "thank-you cards: enabled but HANDWRYTTEN_TEST_MODE is not \"false\"; sweep skipped",
    );
    return result;
  }
  if (await isHandwryttenAccountInTestMode()) {
    // Same burn, other switch: the vendor account itself can be in test
    // mode (their dashboard, Integrations page), invisible to env vars.
    console.error(
      "thank-you cards: Handwrytten ACCOUNT is in test mode; flip it to live on their Integrations page; sweep skipped",
    );
    return result;
  }
  result.skipped = false;
  result.enqueued = await enqueueEligibleFamilies();
  const sendOutcome = await sendQueuedCards();
  result.sent = sendOutcome.sent;
  result.failed = sendOutcome.failed;
  result.mailed = await confirmMailedCards();
  return result;
}

interface EligibleFamilyRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  parent_display_name: string | null;
  address_line: string;
  address_city: string;
  us_state: string;
  address_zip: string;
}

async function enqueueEligibleFamilies(): Promise<number> {
  const sql = mapDb();
  const rows = await sql<EligibleFamilyRow[]>`
    select f.id, f.first_name, f.last_name, f.parent_display_name,
      f.address_line, f.address_city, f.us_state, f.address_zip
    from public.families f
    where f.status <> 'deleted'
      -- Never mail a physical card to a founder test family.
      and not f.sandbox
      and exists (select 1 from public.family_members m where m.family_id = f.id)
      and f.email is not null
      and f.profile_completed_at is not null
      and f.profile_completed_at < now() - interval '48 hours'
      and coalesce(trim(f.address_line), '') <> ''
      and coalesce(trim(f.address_city), '') <> ''
      and coalesce(trim(f.address_zip), '') <> ''
      and f.us_state ~ '^[A-Z]{2}$'
      and not exists (select 1 from public.thank_you_cards t where t.family_id = f.id)
    limit 50
  `;

  let enqueued = 0;
  for (const family of rows) {
    // First word of the parent's name; a family with no usable name is
    // left alone (re-evaluated next sweep, self-heals if a name appears).
    const displayName = (family.first_name ?? family.parent_display_name ?? "").trim();
    const firstName = displayName.split(/\s+/)[0] ?? "";
    if (!firstName) continue;
    const lastName = (family.last_name ?? "").trim();

    const inserted = await sql`
      insert into public.thank_you_cards
        (family_id, recipient_first_name, recipient_last_name,
         address_line, address_city, us_state, address_zip, message)
      values
        (${family.id}, ${firstName}, ${lastName},
         ${family.address_line.trim()}, ${family.address_city.trim()},
         ${family.us_state}, ${family.address_zip.trim()},
         ${thankYouCardMessage(firstName)})
      on conflict (family_id) do nothing
      returning id
    `;
    enqueued += inserted.length;
  }
  return enqueued;
}

interface QueuedCardRow {
  id: string;
  family_id: string;
  recipient_first_name: string;
  recipient_last_name: string;
  address_line: string;
  address_city: string;
  us_state: string;
  address_zip: string;
  message: string;
  attempts: number;
}

async function sendQueuedCards(): Promise<{ sent: number; failed: number }> {
  const sql = mapDb();
  // A crash during the FINAL attempt leaves a 'sending' row the claim
  // below can never pick up again (attempts is maxed). Park it as failed
  // for a human: the vendor may or may not have received that order, so
  // auto-requeueing could double-send.
  await sql`
    update public.thank_you_cards
    set status = 'failed',
        error = coalesce(error, 'crashed mid-send; check the Handwrytten dashboard before requeueing'),
        processing_started_at = null
    where status = 'sending'
      and attempts >= ${MAX_SEND_ATTEMPTS}
      and processing_started_at < now() - (${STALE_PROCESSING_MINUTES} * interval '1 minute')
  `;
  const configuredCap = process.env.THANK_YOU_CARDS_MONTHLY_CAP;
  const parsedCap = configuredCap === undefined ? DEFAULT_MONTHLY_CAP : Number(configuredCap);
  const cap = Number.isFinite(parsedCap) && parsedCap >= 0 ? parsedCap : DEFAULT_MONTHLY_CAP;
  const [{ n: sentThisMonth }] = await sql<[{ n: number }]>`
    select count(*)::int as n from public.thank_you_cards
    where sent_at >= date_trunc('month', now())
  `;
  const budget = Math.min(SEND_BATCH_LIMIT, cap - sentThisMonth);
  if (budget <= 0) return { sent: 0, failed: 0 };

  const queued = await sql<QueuedCardRow[]>`
    with claimed as (
      update public.thank_you_cards c
      set status = 'sending',
          attempts = c.attempts + 1,
          processing_started_at = now(),
          error = null
      where c.id in (
        select id from public.thank_you_cards
        where attempts < ${MAX_SEND_ATTEMPTS}
          and (
            status = 'queued'
            or (
              status = 'sending'
              and processing_started_at < now() - (${STALE_PROCESSING_MINUTES} * interval '1 minute')
            )
          )
        order by queued_at
        limit ${budget}
        for update skip locked
      )
      returning c.id, c.family_id, c.recipient_first_name, c.recipient_last_name,
                c.address_line, c.address_city, c.us_state, c.address_zip,
                c.message, c.attempts
    )
    select * from claimed
  `;

  let sent = 0;
  let failed = 0;
  for (const card of queued) {
    try {
      const { orderId } = await sendHandwryttenCard({
        firstName: card.recipient_first_name,
        lastName: card.recipient_last_name,
        street1: card.address_line,
        city: card.address_city,
        state: card.us_state,
        zip: card.address_zip,
        message: card.message,
        wishes: THANK_YOU_CARD_WISHES,
      });
      // Optimistic lock on attempts, not on a timestamp: attempts is an
      // int that increments on every claim, so it round-trips exactly.
      // The prior processing_started_at text guard never matched in prod
      // (2026-07-11 5pm incident: a PAID vendor order went unrecorded and
      // the row stayed claimable, a double-send in the making).
      const recorded = await sql<{ id: string }[]>`
        update public.thank_you_cards
        set status = 'sent',
            vendor_order_id = ${orderId},
            sent_at = now(),
            processing_started_at = null,
            error = null
        where id = ${card.id} and status = 'sending' and attempts = ${card.attempts}
        returning id
      `;
      if (recorded.length > 0) {
        await emitMapEvent("card.thank_you_sent", { family_id: card.family_id });
        sent += 1;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown";
      const parked = await sql<{ status: string }[]>`
        update public.thank_you_cards
        set error = ${detail.slice(0, 500)},
            processing_started_at = null,
            status = case when attempts >= ${MAX_SEND_ATTEMPTS} then 'failed' else 'queued' end
        where id = ${card.id} and status = 'sending' and attempts = ${card.attempts}
        returning status
      `;
      if (parked[0]?.status === "failed") failed += 1;
      console.error(`thank-you card send failed (family ${card.family_id}):`, detail);
    }
  }
  return { sent, failed };
}

async function confirmMailedCards(): Promise<number> {
  const sql = mapDb();
  const sentRows = await sql<{ id: string; vendor_order_id: string }[]>`
    select id, vendor_order_id from public.thank_you_cards
    where status = 'sent' and vendor_order_id is not null
    limit 25
  `;
  let mailed = 0;
  for (const row of sentRows) {
    try {
      const status = await getHandwryttenOrderStatus(row.vendor_order_id);
      if (status && isMailedStatus(status)) {
        await sql`
          update public.thank_you_cards
          set status = 'mailed', mailed_at = now()
          where id = ${row.id}
        `;
        mailed += 1;
      }
    } catch {
      // Best effort: confirmation is bookkeeping, never worth failing the
      // cron over; the row stays "sent" and re-checks next run.
    }
  }
  return mailed;
}
