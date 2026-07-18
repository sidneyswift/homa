import type { Sql } from "postgres";

import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";

export type OfferFulfillmentKind = "material" | "task";

export interface OfferFulfillmentResult {
  eligible: boolean;
  wrote: boolean;
}

type OfferFulfillmentEvent = (input: {
  familyId: string;
  kind: OfferFulfillmentKind;
}) => Promise<void>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function uuidAttributeFromAttributes(
  attributes: unknown,
  key: "repliedDeliveryId" | "episodeId",
): string | null {
  if (
    !attributes ||
    typeof attributes !== "object" ||
    !(key in attributes)
  ) {
    return null;
  }
  const value = (attributes as Record<string, unknown>)[key];
  return typeof value === "string" && UUID.test(value)
    ? value
    : null;
}

export function offerDeliveryIdFromAttributes(
  attributes: unknown,
): string | null {
  return uuidAttributeFromAttributes(attributes, "repliedDeliveryId");
}

export function offerEpisodeIdFromAttributes(
  attributes: unknown,
): string | null {
  return uuidAttributeFromAttributes(attributes, "episodeId");
}

/**
 * Records only a completed deterministic effect for a causally accepted
 * morning brief offer. Both the source and result are re-scoped inside the
 * authenticated family before the idempotent insert.
 */
export async function recordAcceptedOfferFulfillmentWithDatabase(
  database: Sql,
  input: {
    familyId: string;
    sourceDeliveryId: string | null;
    episodeId: string | null;
    kind: OfferFulfillmentKind;
    referenceId: string;
    emit: OfferFulfillmentEvent;
  },
): Promise<OfferFulfillmentResult> {
  const rows = await database<OfferFulfillmentResult[]>`
    with candidates as (
      select d.id
      from public.conversation_deliveries d
      join public.conversation_open_loops l
        on l.delivery_id = d.id
       and l.family_id = d.family_id
      join public.homa_task_runs r
        on r.id = d.task_run_id
       and r.family_id = d.family_id
      where d.id = ${input.sourceDeliveryId}
        or (
          ${input.sourceDeliveryId}::uuid is null
          and ${input.episodeId}::uuid is not null
          and d.episode_id = ${input.episodeId}
          and l.resolved_at >= now() - interval '24 hours'
          and not exists (
            select 1
            from public.conversation_offer_fulfillments existing
            where existing.source_delivery_id = d.id
          )
        )
    ),
    scoped_candidates as (
      select candidates.id
      from candidates
      join public.conversation_deliveries d on d.id = candidates.id
      join public.conversation_open_loops l
        on l.delivery_id = d.id
       and l.family_id = d.family_id
      join public.homa_task_runs r
        on r.id = d.task_run_id
       and r.family_id = d.family_id
      where d.family_id = ${input.familyId}
        and d.status = 'sent'
        and r.kind = 'morning_brief'
        and l.state = 'resolved'
        and l.resolved_outcome = 'accepted'
        and (
          (
            ${input.kind}::text = 'material'
            and exists (
              select 1
              from public.materials m
              where m.id = ${input.referenceId}
                and m.family_id = ${input.familyId}
            )
          )
          or
          (
            ${input.kind}::text = 'task'
            and exists (
              select 1
              from public.agent_schedules s
              where s.id = ${input.referenceId}
                and s.family_id = ${input.familyId}
            )
          )
        )
    ),
    eligible as (
      select id
      from scoped_candidates
      where ${input.sourceDeliveryId}::uuid is not null
         or (select count(*) from scoped_candidates) = 1
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
      returning id
    )
    select
      exists (select 1 from eligible) as eligible,
      exists (select 1 from written) as wrote
  `;
  const result = rows[0] ?? { eligible: false, wrote: false };
  if (result.wrote) {
    try {
      await input.emit({ familyId: input.familyId, kind: input.kind });
    } catch {
      console.error("offer fulfillment analytics emission failed");
    }
  }
  return result;
}

export async function recordAcceptedOfferFulfillment(input: {
  familyId: string;
  sourceDeliveryId: string | null;
  episodeId: string | null;
  kind: OfferFulfillmentKind;
  referenceId: string;
}): Promise<OfferFulfillmentResult> {
  if (!input.sourceDeliveryId && !input.episodeId) {
    return { eligible: false, wrote: false };
  }
  return await recordAcceptedOfferFulfillmentWithDatabase(mapDb(), {
    ...input,
    sourceDeliveryId: input.sourceDeliveryId,
    emit: async ({ familyId, kind }) => {
      await emitMapEvent("conversation.offer_fulfilled", {
        family_id: familyId,
        source: "morning_brief",
        fulfillment_kind: kind,
      });
    },
  });
}
