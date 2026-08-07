import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildFulfillmentRecoveryMessage,
  findCurrentOfferRecoveryRecipient,
  findRecoverableOffers,
  planOfferRecovery,
  recoverUnfulfilledOffers,
  DEFAULT_OFFER_RECOVERY_CONFIG,
  type RecoverableOffer,
} from "./offer-recovery";

function offer(overrides: Partial<RecoverableOffer> = {}): RecoverableOffer {
  return {
    sourceDeliveryId: "11111111-1111-4111-8111-111111111111",
    familyId: "22222222-2222-4222-8222-222222222222",
    recipientMemberUserId: "33333333-3333-4333-8333-333333333333",
    channel: "sms",
    offerText: "Want me to make Noah a worksheet for project planning?",
    attempts: 0,
    minutesSinceAccepted: 30,
    ...overrides,
  };
}

test("planOfferRecovery passes a stale, un-retried, non-empty offer", () => {
  assert.deepEqual(planOfferRecovery([offer()]).length, 1);
});

test("planOfferRecovery holds an offer that is not stale yet", () => {
  // Fulfillment normally lands within seconds; under the threshold it may
  // still be in flight, so recovery must not race a live turn.
  assert.deepEqual(planOfferRecovery([offer({ minutesSinceAccepted: 5 })]), []);
});

test("planOfferRecovery stops once the attempt ceiling is reached", () => {
  assert.deepEqual(
    planOfferRecovery([
      offer({ attempts: DEFAULT_OFFER_RECOVERY_CONFIG.maxAttempts }),
    ]),
    [],
  );
});

test("planOfferRecovery skips an offer with no recoverable text", () => {
  assert.deepEqual(planOfferRecovery([offer({ offerText: "   " })]), []);
});

test("buildFulfillmentRecoveryMessage quotes the offer and forbids re-asking", () => {
  const message = buildFulfillmentRecoveryMessage(
    "Want me to make Noah a worksheet for project planning?",
  );
  assert.match(message, /already accepted/);
  assert.match(message, /Do not ask again/);
  assert.match(message, /worksheet for project planning/);
});

test("findRecoverableOffers requires the source delivery's current exact adult", async () => {
  let query = "";
  const database = ((strings: TemplateStringsArray) => {
    query = strings.join("?");
    return Promise.resolve([]);
  }) as never;
  assert.deepEqual(
    await findRecoverableOffers(
      database,
      new Date("2026-08-07T12:00:00.000Z"),
    ),
    [],
  );
  assert.match(query, /d\.recipient_member_user_id::text/u);
  assert.match(
    query,
    /join public\.family_members recipient[\s\S]*recipient\.family_id = d\.family_id[\s\S]*recipient\.user_id = d\.recipient_member_user_id/u,
  );
  assert.match(
    query,
    /join public\.conversation_messages resolver[\s\S]*resolver\.id = l\.resolved_by_message_id[\s\S]*resolver\.member_user_id = d\.recipient_member_user_id/u,
  );
  assert.match(query, /f\.status <> 'deleted'/u);
});

test("findCurrentOfferRecoveryRecipient verifies current membership and resolver provenance", async () => {
  let query = "";
  const database = ((strings: TemplateStringsArray) => {
    query = strings.join("?");
    return Promise.resolve([
      { recipient_member_user_id: "33333333-3333-4333-8333-333333333333" },
    ]);
  }) as never;
  assert.equal(
    await findCurrentOfferRecoveryRecipient(
      {
        familyId: "22222222-2222-4222-8222-222222222222",
        sourceDeliveryId: "11111111-1111-4111-8111-111111111111",
      },
      database,
    ),
    "33333333-3333-4333-8333-333333333333",
  );
  assert.match(
    query,
    /resolver\.id = loop\.resolved_by_message_id[\s\S]*resolver\.member_user_id = delivery\.recipient_member_user_id/u,
  );
  assert.match(
    query,
    /current_member\.user_id = delivery\.recipient_member_user_id/u,
  );
  assert.match(query, /task_run\.kind = 'morning_brief'/u);
  assert.match(query, /family\.status <> 'deleted'/u);
});

test("recoverUnfulfilledOffers records an attempt before it dispatches", async () => {
  // The attempt must be burned first so a dispatch crash still counts
  // against the ceiling and cannot loop forever.
  const order: string[] = [];
  const result = await recoverUnfulfilledOffers(
    async () => {
      order.push("dispatch");
    },
    {
      database: {} as never,
      now: new Date("2026-07-23T12:00:00.000Z"),
      find: async () => [offer()],
      record: async () => {
        order.push("record");
      },
    },
  );
  assert.equal(result.attempted, 1);
  assert.deepEqual(order, ["record", "dispatch"]);
});

test("recoverUnfulfilledOffers still counts the attempt when dispatch throws", async () => {
  // A dispatch crash must not stop the attempt from being recorded, or a
  // deterministically-failing fulfillment would re-dispatch every tick.
  const recorded: string[] = [];
  const result = await recoverUnfulfilledOffers(
    async () => {
      throw new Error("dispatch boom");
    },
    {
      database: {} as never,
      find: async () => [offer()],
      record: async (_db, input) => {
        recorded.push(input.sourceDeliveryId);
      },
    },
  );
  assert.equal(result.attempted, 0);
  assert.deepEqual(recorded.length, 1);
});

test("recoverUnfulfilledOffers dispatches nothing when the plan is empty", async () => {
  let dispatched = 0;
  const result = await recoverUnfulfilledOffers(
    async () => {
      dispatched += 1;
    },
    {
      database: {} as never,
      find: async () => [offer({ minutesSinceAccepted: 2 })],
      record: async () => undefined,
    },
  );
  assert.equal(result.attempted, 0);
  assert.equal(dispatched, 0);
});
