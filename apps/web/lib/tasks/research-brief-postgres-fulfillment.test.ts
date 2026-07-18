import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acceptedOfferDeliveryIdFromAttributes,
  recordAcceptedOfferFulfillmentWithDatabase,
} from "../conversation-continuity/offer-fulfillment";
import {
  createDisposableResearchBriefPostgresHarness,
  familyAId,
  familyBId,
  runId,
} from "./research-brief-postgres-harness";

const harness = createDisposableResearchBriefPostgresHarness(
  "offer_fulfillment",
);
const messageId = "00000000-0000-4000-a000-000000000081";
const deliveryId = "00000000-0000-4000-b000-000000000081";
const episodeId = "00000000-0000-4000-9000-000000000081";
const materialId = "00000000-0000-4000-c000-000000000081";
const foreignMaterialId = "00000000-0000-4000-c000-000000000082";

describe("accepted offer fulfillment", () => {
  before(async () => {
    await harness.start();
    const db = harness.database();
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, content, visibility
      )
      values (
        ${messageId}, ${familyAId}, ${runId(1)}, 'assistant',
        'Want me to make a word strip?', 'family'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        id, family_id, episode_id, message_id, task_run_id, channel, status,
        sent_at
      )
      values (
        ${deliveryId}, ${familyAId}, ${episodeId}, ${messageId}, ${runId(1)},
        'sms', 'sent', now()
      )
    `;
    await db`
      insert into public.conversation_open_loops (
        family_id, message_id, delivery_id, kind, state, expires_at,
        resolved_at, resolved_outcome
      )
      values (
        ${familyAId}, ${messageId}, ${deliveryId}, 'yes_no', 'resolved',
        now() + interval '24 hours', now(), 'accepted'
      )
    `;
    await db`
      insert into public.materials (id, family_id)
      values
        (${materialId}, ${familyAId}),
        (${foreignMaterialId}, ${familyBId})
    `;
  });

  after(async () => await harness.stop());

  it("reads only a trusted UUID delivery id from continuity attributes", () => {
    assert.equal(
      acceptedOfferDeliveryIdFromAttributes({
        acceptedOfferDeliveryId: deliveryId,
      }),
      deliveryId,
    );
    assert.equal(
      acceptedOfferDeliveryIdFromAttributes({
        acceptedOfferDeliveryId: "not-a-uuid",
      }),
      null,
    );
    assert.equal(acceptedOfferDeliveryIdFromAttributes(null), null);
  });

  it("records one scoped fulfillment for an accepted morning offer", async () => {
    const events: unknown[] = [];
    const result = await recordAcceptedOfferFulfillmentWithDatabase(
      harness.database(),
      {
        familyId: familyAId,
        sourceDeliveryId: deliveryId,
        kind: "material",
        referenceId: materialId,
        emit: async (event) => {
          events.push(event);
        },
      },
    );

    assert.deepEqual(result, { eligible: true, wrote: true });
    assert.deepEqual(events, [
      { familyId: familyAId, kind: "material" },
    ]);
  });

  it("is idempotent for a repeated tool completion", async () => {
    const result = await recordAcceptedOfferFulfillmentWithDatabase(
      harness.database(),
      {
        familyId: familyAId,
        sourceDeliveryId: deliveryId,
        kind: "material",
        referenceId: materialId,
        emit: async () => assert.fail("duplicate should not emit"),
      },
    );

    assert.deepEqual(result, { eligible: true, wrote: false });
  });

  it("rejects a result identifier from another family", async () => {
    const result = await recordAcceptedOfferFulfillmentWithDatabase(
      harness.database(),
      {
        familyId: familyAId,
        sourceDeliveryId: deliveryId,
        kind: "material",
        referenceId: foreignMaterialId,
        emit: async () => assert.fail("foreign result should not emit"),
      },
    );

    assert.deepEqual(result, { eligible: false, wrote: false });
  });

  it("does nothing without an exact accepted delivery id", async () => {
    const result = await recordAcceptedOfferFulfillmentWithDatabase(
      harness.database(),
      {
        familyId: familyAId,
        sourceDeliveryId: null,
        kind: "material",
        referenceId: materialId,
        emit: async () => assert.fail("missing source should not emit"),
      },
    );

    assert.deepEqual(result, { eligible: false, wrote: false });
  });

  it("records a scoped scheduled-task fulfillment", async () => {
    const db = harness.database();
    const taskMessageId = "00000000-0000-4000-a000-000000000085";
    const taskDeliveryId = "00000000-0000-4000-b000-000000000085";
    const taskEpisodeId = "00000000-0000-4000-9000-000000000085";
    const scheduleId = "00000000-0000-4000-d000-000000000085";
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, content, visibility
      )
      values (
        ${taskMessageId}, ${familyAId}, ${runId(7)}, 'assistant',
        'Want me to schedule that?', 'family'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        id, family_id, episode_id, message_id, task_run_id, channel, status,
        sent_at
      )
      values (
        ${taskDeliveryId}, ${familyAId}, ${taskEpisodeId},
        ${taskMessageId}, ${runId(7)}, 'sms', 'sent', now()
      )
    `;
    await db`
      insert into public.conversation_open_loops (
        family_id, episode_id, message_id, delivery_id, kind, state,
        expires_at, resolved_at, resolved_outcome
      )
      values (
        ${familyAId}, ${taskEpisodeId}, ${taskMessageId},
        ${taskDeliveryId}, 'yes_no', 'resolved',
        now() + interval '24 hours', now(), 'accepted'
      )
    `;
    await db`
      insert into public.agent_schedules (
        id, family_id, kind, next_run_at, local_hour, weekdays,
        source_offer_delivery_id
      )
      values (
        ${scheduleId}, ${familyAId}, 'custom', now(), 9,
        ${db.array([1, 2, 3, 4, 5])}::smallint[], ${taskDeliveryId}
      )
    `;

    const result = await recordAcceptedOfferFulfillmentWithDatabase(db, {
      familyId: familyAId,
      sourceDeliveryId: taskDeliveryId,
      kind: "task",
      referenceId: scheduleId,
      emit: async () => undefined,
    });

    assert.deepEqual(result, { eligible: true, wrote: true });
  });

  it("uses the exact accepted offer carried through clarification", async () => {
    const db = harness.database();
    const delayedMessageId = "00000000-0000-4000-a000-000000000083";
    const delayedDeliveryId = "00000000-0000-4000-b000-000000000083";
    const delayedEpisodeId = "00000000-0000-4000-9000-000000000083";
    const delayedMaterialId = "00000000-0000-4000-c000-000000000083";
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, content, visibility
      )
      values (
        ${delayedMessageId}, ${familyAId}, ${runId(5)}, 'assistant',
        'Want me to set that up?', 'family'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        id, family_id, episode_id, message_id, task_run_id, channel, status,
        sent_at
      )
      values (
        ${delayedDeliveryId}, ${familyAId}, ${delayedEpisodeId},
        ${delayedMessageId}, ${runId(5)}, 'sms', 'sent', now()
      )
    `;
    await db`
      insert into public.conversation_open_loops (
        family_id, episode_id, message_id, delivery_id, kind, state,
        expires_at, resolved_at, resolved_outcome
      )
      values (
        ${familyAId}, ${delayedEpisodeId}, ${delayedMessageId},
        ${delayedDeliveryId}, 'yes_no', 'resolved',
        now() + interval '24 hours', now(), 'accepted'
      )
    `;
    await db`
      insert into public.materials (id, family_id)
      values (${delayedMaterialId}, ${familyAId})
    `;
    await db`
      insert into public.conversation_thread_bindings (
        family_id, channel, thread_key_hash, pending_offer_delivery_id
      )
      values (
        ${familyAId}, 'sms', 'delayed-thread', ${delayedDeliveryId}
      )
    `;

    const result = await recordAcceptedOfferFulfillmentWithDatabase(db, {
      familyId: familyAId,
      sourceDeliveryId: delayedDeliveryId,
      kind: "material",
      referenceId: delayedMaterialId,
      emit: async () => undefined,
    });

    assert.deepEqual(result, { eligible: true, wrote: true });
    const [binding] = await db<{ pending_offer_delivery_id: string | null }[]>`
      select pending_offer_delivery_id
      from public.conversation_thread_bindings
      where thread_key_hash = 'delayed-thread'
    `;
    assert.equal(binding.pending_offer_delivery_id, null);
  });

  it("does not attach a later tool result to a stale accepted offer", async () => {
    const db = harness.database();
    const staleMessageId = "00000000-0000-4000-a000-000000000084";
    const staleDeliveryId = "00000000-0000-4000-b000-000000000084";
    const staleEpisodeId = "00000000-0000-4000-9000-000000000084";
    const staleMaterialId = "00000000-0000-4000-c000-000000000084";
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, content, visibility
      )
      values (
        ${staleMessageId}, ${familyAId}, ${runId(6)}, 'assistant',
        'Want me to make that?', 'family'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        id, family_id, episode_id, message_id, task_run_id, channel, status,
        sent_at
      )
      values (
        ${staleDeliveryId}, ${familyAId}, ${staleEpisodeId},
        ${staleMessageId}, ${runId(6)}, 'sms', 'sent',
        now() - interval '3 days'
      )
    `;
    await db`
      insert into public.conversation_open_loops (
        family_id, episode_id, message_id, delivery_id, kind, state,
        expires_at, resolved_at, resolved_outcome
      )
      values (
        ${familyAId}, ${staleEpisodeId}, ${staleMessageId},
        ${staleDeliveryId}, 'yes_no', 'resolved',
        now() - interval '2 days', now() - interval '2 days', 'accepted'
      )
    `;
    await db`
      insert into public.materials (id, family_id)
      values (${staleMaterialId}, ${familyAId})
    `;

    const result = await recordAcceptedOfferFulfillmentWithDatabase(db, {
      familyId: familyAId,
      sourceDeliveryId: staleDeliveryId,
      kind: "material",
      referenceId: staleMaterialId,
      emit: async () => assert.fail("stale offer should not emit"),
    });

    assert.deepEqual(result, { eligible: false, wrote: false });
  });
});
