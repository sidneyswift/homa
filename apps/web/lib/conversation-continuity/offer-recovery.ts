import type { Sql } from "postgres";

import { mapDb } from "../map/db";

/**
 * Auto-recovery for accepted morning-brief offers whose fulfillment turn
 * dropped (founder ruling 2026-07-23: remake and deliver the artifact, do
 * not make the parent ask again). Acceptance and fulfillment are decoupled:
 * the reply loop resolves 'accepted' as its own step, then create_printable
 * (or create_task) builds the artifact inline in the agent turn and records
 * a conversation_offer_fulfillments row. When that turn crashes after the
 * acceptance is booked, the family gets silence where an artifact was
 * promised (the 2026-07-20 Chan drop, Noah's project-planning worksheet).
 *
 * Recovery re-runs the fulfillment on the proactive dispatch rails, seeded
 * with the offer's own delivery id in acceptedOfferDeliveryId so the
 * fulfilling tool links and dedupes against the exact offer. Three
 * guarantees keep this safe to run against live families:
 *   1. Idempotent: conversation_offer_fulfillments is unique on
 *      source_delivery_id, so a redelivery is impossible even if the
 *      original turn had partially fulfilled.
 *   2. Bounded: conversation_offer_recovery counts attempts, so a
 *      deterministically-failing fulfillment stops re-dispatching.
 *   3. Windowed: only offers still inside the 24h window in which
 *      reserveAcceptedOfferFulfillment treats an offer as re-fulfillable,
 *      which also excludes the pre-ledger era (fulfillment recording only
 *      exists since 2026-07-18).
 *
 * The actual agent wake-up is an injected dependency (dispatchFulfillment)
 * so the planning and bookkeeping here stay pure and unit-tested, and the
 * intricate dispatch wiring lives at the schedule call site behind a flag.
 */

/** Fulfillment rides the same turn as acceptance, so seconds is normal and
 * minutes past acceptance means the turn dropped. Matches the inbound-stall
 * threshold in lib/admin/overview-data.ts on purpose. */
export const OFFER_RECOVERY_STALE_MINUTES = 15;
/** The window reserveAcceptedOfferFulfillment still honors; beyond it an
 * offer ages out to a manual re-engage, never a silent auto-send days late. */
export const OFFER_RECOVERY_WINDOW_HOURS = 24;
/** A genuinely-stuck fulfillment (a deterministic crash) must not re-dispatch
 * every hour forever. Two attempts, then it stays on the founder console. */
export const OFFER_RECOVERY_MAX_ATTEMPTS = 2;

export interface RecoverableOffer {
  sourceDeliveryId: string;
  familyId: string;
  channel: string;
  /** The assistant message that made the offer, so the recovery turn knows
   * exactly what it promised to build. */
  offerText: string;
  attempts: number;
  /** Whole minutes since the parent accepted; drives the stale gate. */
  minutesSinceAccepted: number;
}

export interface OfferRecoveryConfig {
  staleMinutes: number;
  windowHours: number;
  maxAttempts: number;
}

export const DEFAULT_OFFER_RECOVERY_CONFIG: OfferRecoveryConfig = {
  staleMinutes: OFFER_RECOVERY_STALE_MINUTES,
  windowHours: OFFER_RECOVERY_WINDOW_HOURS,
  maxAttempts: OFFER_RECOVERY_MAX_ATTEMPTS,
};

/**
 * Pure gate: which candidate offers should be dispatched for recovery this
 * tick. The SQL finder already applies the window and the fulfillment/attempt
 * joins, but keeping the decision here as well means the rule is unit-tested
 * and a finder change cannot silently loosen it. Stale enough to be a real
 * drop, and still under the attempt ceiling.
 */
export function planOfferRecovery(
  candidates: readonly RecoverableOffer[],
  config: OfferRecoveryConfig = DEFAULT_OFFER_RECOVERY_CONFIG,
): RecoverableOffer[] {
  return candidates.filter(
    (offer) =>
      offer.offerText.trim().length > 0 &&
      offer.minutesSinceAccepted >= config.staleMinutes &&
      offer.attempts < config.maxAttempts,
  );
}

/**
 * The message that wakes the agent to finish what it promised. It is not
 * family-facing copy: it is an internal instruction the agent reads, then
 * composes its own reply and builds the artifact. Quotes the original offer
 * verbatim so the agent rebuilds the same thing, and is explicit that the
 * parent already said yes so the agent does not re-ask.
 */
export function buildFulfillmentRecoveryMessage(offerText: string): string {
  return [
    "This family already accepted an offer you made, but the turn that was",
    "supposed to build it did not finish, so nothing was delivered. Make the",
    "thing you offered now and send it, exactly as promised. Do not ask again",
    "whether they want it (they already said yes) and do not re-explain the",
    "research; just deliver the artifact with a short, warm note.",
    "",
    "The offer you made was:",
    offerText.trim(),
  ].join("\n");
}

/**
 * Candidate offers to recover: a morning-brief offer resolved 'accepted' on a
 * sent delivery, inside the window, past the stale threshold, with no
 * fulfillment row and under the attempt ceiling. The offer text is the
 * assistant message the delivery carried.
 */
export async function findRecoverableOffers(
  database: Sql,
  now: Date,
  config: OfferRecoveryConfig = DEFAULT_OFFER_RECOVERY_CONFIG,
): Promise<RecoverableOffer[]> {
  const rows = await database<
    {
      source_delivery_id: string;
      family_id: string;
      channel: string;
      offer_text: string | null;
      attempts: number | null;
      minutes_since_accepted: number;
    }[]
  >`
    select
      d.id as source_delivery_id,
      d.family_id,
      d.channel,
      m.content as offer_text,
      coalesce(rec.attempts, 0) as attempts,
      floor(extract(epoch from (${now.toISOString()}::timestamptz - l.resolved_at)) / 60)::int
        as minutes_since_accepted
    from public.conversation_open_loops l
    join public.conversation_deliveries d
      on d.id = l.delivery_id and d.family_id = l.family_id
    join public.homa_task_runs r
      on r.id = d.task_run_id and r.family_id = d.family_id
    join public.families f on f.id = l.family_id
    left join public.conversation_messages m
      on m.id = d.message_id and m.family_id = d.family_id
    left join public.conversation_offer_recovery rec
      on rec.source_delivery_id = d.id
    where l.state = 'resolved'
      and l.resolved_outcome = 'accepted'
      and r.kind = 'morning_brief'
      and d.status = 'sent'
      and l.resolved_at < ${now.toISOString()}::timestamptz - ${`${config.staleMinutes} minutes`}::interval
      and l.resolved_at >= ${now.toISOString()}::timestamptz - ${`${config.windowHours} hours`}::interval
      and not f.sandbox
      and coalesce(rec.attempts, 0) < ${config.maxAttempts}
      and rec.recovered_at is null
      and not exists (
        select 1 from public.conversation_offer_fulfillments cof
        where cof.source_delivery_id = d.id and cof.family_id = l.family_id
      )
    order by l.resolved_at desc
    limit 20
  `;
  return rows
    .filter((row): row is typeof row & { offer_text: string } =>
      Boolean(row.offer_text),
    )
    .map((row) => ({
      sourceDeliveryId: row.source_delivery_id,
      familyId: row.family_id,
      channel: row.channel,
      offerText: row.offer_text,
      attempts: row.attempts ?? 0,
      minutesSinceAccepted: row.minutes_since_accepted,
    }));
}

/** Records one recovery attempt before dispatch, so a crash mid-dispatch
 * still counts against the ceiling and cannot loop. Upsert keyed by the
 * offer's delivery. */
export async function recordRecoveryAttempt(
  database: Sql,
  input: { sourceDeliveryId: string; familyId: string },
): Promise<void> {
  await database`
    insert into public.conversation_offer_recovery
      (source_delivery_id, family_id, attempts, last_attempt_at)
    values (${input.sourceDeliveryId}, ${input.familyId}, 1, now())
    on conflict (source_delivery_id) do update
      set attempts = public.conversation_offer_recovery.attempts + 1,
          last_attempt_at = now(),
          updated_at = now()
  `;
}

export interface OfferRecoveryDispatch {
  (offer: RecoverableOffer): Promise<void>;
}

export interface OfferRecoveryResult {
  attempted: number;
}

/**
 * The tick: find recoverable offers, and for each one the plan clears,
 * record the attempt then dispatch. The attempt is recorded first so a
 * dispatch crash still burns an attempt (fail closed against loops). The
 * dispatch itself is injected so the schedule owns the agent wake-up and
 * this stays testable.
 */
export async function recoverUnfulfilledOffers(
  dispatch: OfferRecoveryDispatch,
  options: {
    now?: Date;
    config?: OfferRecoveryConfig;
    database?: Sql;
    /** Injectable for tests; defaults to the SQL finder. */
    find?: (
      database: Sql,
      now: Date,
      config: OfferRecoveryConfig,
    ) => Promise<RecoverableOffer[]>;
    /** Injectable for tests; defaults to the durable attempt upsert. */
    record?: (
      database: Sql,
      input: { sourceDeliveryId: string; familyId: string },
    ) => Promise<void>;
  } = {},
): Promise<OfferRecoveryResult> {
  const database = options.database ?? mapDb();
  const now = options.now ?? new Date();
  const config = options.config ?? DEFAULT_OFFER_RECOVERY_CONFIG;
  const find = options.find ?? findRecoverableOffers;
  const record = options.record ?? recordRecoveryAttempt;
  const candidates = await find(database, now, config);
  const planned = planOfferRecovery(candidates, config);
  let attempted = 0;
  for (const offer of planned) {
    try {
      await record(database, {
        sourceDeliveryId: offer.sourceDeliveryId,
        familyId: offer.familyId,
      });
      await dispatch(offer);
      attempted += 1;
    } catch (error) {
      console.error(
        `offer recovery dispatch failed for family ${offer.familyId}:`,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
  return { attempted };
}
