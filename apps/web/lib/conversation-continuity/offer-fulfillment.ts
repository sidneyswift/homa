import type { Sql } from "postgres";

import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";

export type OfferFulfillmentKind = "material" | "task";

export interface OfferFulfillmentResult {
  eligible: boolean;
  wrote: boolean;
}

export interface OfferFulfillmentReservation extends OfferFulfillmentResult {
  referenceId: string | null;
}

export interface OfferFulfillmentCompletion {
  completed: boolean;
  wrote: boolean;
}

type OfferFulfillmentEvent = (input: {
  familyId: string;
  kind: OfferFulfillmentKind;
}) => Promise<void>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function acceptedOfferDeliveryIdFromAttributes(
  attributes: unknown,
): string | null {
  if (
    !attributes ||
    typeof attributes !== "object" ||
    !("acceptedOfferDeliveryId" in attributes)
  ) {
    return null;
  }
  const value = (attributes as { acceptedOfferDeliveryId?: unknown })
    .acceptedOfferDeliveryId;
  return typeof value === "string" && UUID.test(value)
    ? value
    : null;
}

export async function reserveAcceptedOfferFulfillmentWithDatabase(
  database: Sql,
  input: {
    familyId: string;
    sourceDeliveryId: string | null;
    kind: OfferFulfillmentKind;
    referenceId: string;
  },
): Promise<OfferFulfillmentReservation> {
  const rows = await database<
    Array<OfferFulfillmentResult & { reference_id: string | null }>
  >`
    with eligible as (
      select d.id
      from public.conversation_deliveries d
      join public.conversation_open_loops l
        on l.delivery_id = d.id
       and l.family_id = d.family_id
      join public.homa_task_runs r
        on r.id = d.task_run_id
       and r.family_id = d.family_id
      where d.id = ${input.sourceDeliveryId}
        and d.family_id = ${input.familyId}
        and d.status = 'sent'
        and r.kind = 'morning_brief'
        and l.state = 'resolved'
        and l.resolved_outcome = 'accepted'
        and l.resolved_at >= now() - interval '24 hours'
    ),
    written as (
      insert into public.conversation_offer_fulfillments (
        family_id,
        source_delivery_id,
        kind,
        reference_id
      )
      select
        ${input.familyId},
        id,
        ${input.kind},
        ${input.referenceId}
      from eligible
      on conflict (source_delivery_id) do nothing
      returning reference_id
    ),
    selected as (
      select written.reference_id
      from written
      union all
      select fulfillment.reference_id
      from public.conversation_offer_fulfillments fulfillment
      join eligible
        on eligible.id = fulfillment.source_delivery_id
      where fulfillment.family_id = ${input.familyId}
        and fulfillment.kind = ${input.kind}
        and not exists (select 1 from written)
    )
    select
      exists (select 1 from eligible) as eligible,
      exists (select 1 from written) as wrote,
      (select reference_id::text from selected limit 1) as reference_id
  `;
  return {
    eligible: rows[0]?.eligible ?? false,
    wrote: rows[0]?.wrote ?? false,
    referenceId: rows[0]?.reference_id ?? null,
  };
}

export async function completeAcceptedOfferFulfillmentWithDatabase(
  database: Sql,
  input: {
    familyId: string;
    sourceDeliveryId: string;
    kind: OfferFulfillmentKind;
    referenceId: string;
  },
): Promise<OfferFulfillmentCompletion> {
  const rows = await database<{ completed: boolean; wrote: boolean }[]>`
    with target as (
      select fulfillment.id
      from public.conversation_offer_fulfillments fulfillment
      where fulfillment.family_id = ${input.familyId}
        and fulfillment.source_delivery_id = ${input.sourceDeliveryId}
        and fulfillment.kind = ${input.kind}
        and fulfillment.reference_id = ${input.referenceId}
        and (
          (
            fulfillment.kind = 'material'
            and exists (
              select 1
              from public.materials material
              where material.id = fulfillment.reference_id
                and material.family_id = fulfillment.family_id
            )
          )
          or
          (
            fulfillment.kind = 'task'
            and exists (
              select 1
              from public.agent_schedules schedule
              where schedule.id = fulfillment.reference_id
                and schedule.family_id = fulfillment.family_id
            )
          )
        )
    ),
    stamped_material as (
      update public.materials material
      set source_offer_delivery_id = ${input.sourceDeliveryId}
      from target
      where ${input.kind}::text = 'material'
        and material.id = ${input.referenceId}
        and material.family_id = ${input.familyId}
      returning material.id
    ),
    stamped_task as (
      update public.agent_schedules schedule
      set source_offer_delivery_id = ${input.sourceDeliveryId}
      from target
      where ${input.kind}::text = 'task'
        and schedule.id = ${input.referenceId}
        and schedule.family_id = ${input.familyId}
      returning schedule.id
    ),
    completed as (
      update public.conversation_offer_fulfillments fulfillment
      set completed_at = coalesce(fulfillment.completed_at, now())
      from target
      where fulfillment.id = target.id
        and fulfillment.completed_at is null
      returning fulfillment.source_delivery_id
    ),
    cleared as (
      update public.conversation_thread_bindings binding
      set pending_offer_delivery_id = null
      where binding.family_id = ${input.familyId}
        and binding.pending_offer_delivery_id = ${input.sourceDeliveryId}
        and exists (select 1 from target)
      returning binding.thread_key_hash
    )
    select
      exists (select 1 from target) as completed,
      exists (select 1 from completed) as wrote,
      (select count(*) from stamped_material) +
        (select count(*) from stamped_task) +
        (select count(*) from cleared) as side_effects
  `;
  return {
    completed: rows[0]?.completed ?? false,
    wrote: rows[0]?.wrote ?? false,
  };
}

export async function recordAcceptedOfferFulfillmentWithDatabase(
  database: Sql,
  input: {
    familyId: string;
    sourceDeliveryId: string | null;
    kind: OfferFulfillmentKind;
    referenceId: string;
    emit: OfferFulfillmentEvent;
  },
): Promise<OfferFulfillmentResult> {
  const reservation = await reserveAcceptedOfferFulfillmentWithDatabase(
    database,
    input,
  );
  if (!reservation.referenceId) {
    return { eligible: reservation.eligible, wrote: reservation.wrote };
  }
  if (reservation.referenceId !== input.referenceId) {
    return { eligible: false, wrote: false };
  }
  const completion = await completeAcceptedOfferFulfillmentWithDatabase(
    database,
    {
      ...input,
      sourceDeliveryId: input.sourceDeliveryId as string,
      referenceId: reservation.referenceId,
    },
  );
  if (completion.wrote && reservation.wrote) {
    try {
      await input.emit({ familyId: input.familyId, kind: input.kind });
    } catch {
      console.error("offer fulfillment analytics emission failed");
    }
  }
  return { eligible: reservation.eligible, wrote: reservation.wrote };
}

export async function reserveAcceptedOfferFulfillment(input: {
  familyId: string;
  sourceDeliveryId: string | null;
  kind: OfferFulfillmentKind;
  referenceId: string;
}): Promise<OfferFulfillmentReservation> {
  if (!input.sourceDeliveryId) {
    return { eligible: false, wrote: false, referenceId: null };
  }
  return await reserveAcceptedOfferFulfillmentWithDatabase(mapDb(), input);
}

export async function completeAcceptedOfferFulfillment(input: {
  familyId: string;
  sourceDeliveryId: string;
  kind: OfferFulfillmentKind;
  referenceId: string;
}): Promise<boolean> {
  const completion = await completeAcceptedOfferFulfillmentWithDatabase(
    mapDb(),
    input,
  );
  if (completion.wrote) {
    await emitMapEvent("conversation.offer_fulfilled", {
      family_id: input.familyId,
      source: "morning_brief",
      fulfillment_kind: input.kind,
    });
  }
  return completion.completed;
}

export async function recordAcceptedOfferFulfillment(input: {
  familyId: string;
  sourceDeliveryId: string | null;
  kind: OfferFulfillmentKind;
  referenceId: string;
}): Promise<OfferFulfillmentResult> {
  if (!input.sourceDeliveryId) {
    return { eligible: false, wrote: false };
  }
  return await recordAcceptedOfferFulfillmentWithDatabase(mapDb(), {
    ...input,
    emit: async ({ familyId, kind }) => {
      await emitMapEvent("conversation.offer_fulfilled", {
        family_id: familyId,
        source: "morning_brief",
        fulfillment_kind: kind,
      });
    },
  });
}
