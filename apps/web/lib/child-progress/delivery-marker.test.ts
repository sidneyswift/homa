import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { getMapItem, personalizeStatement } from "@homa/core";

import type {
  DeliveryAttempt,
} from "../conversation-continuity/delivery-ledger";
import {
  bindProgressCheckInAfterSuccessfulDelivery,
  type ProgressDeliveryBindingDependencies,
} from "./delivery-binding";
import type { ProgressCheckInRecord } from "./types";

const NOW = new Date("2026-07-11T23:55:00.000Z");
const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEMBER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ITEM = getMapItem("math.counts-to-5");
const ORIGINAL_LIVE_PROGRESS_FLAG =
  process.env.HOMA_LIVE_PROGRESS_ENABLED;

process.env.HOMA_LIVE_PROGRESS_ENABLED = "true";
after(() => {
  if (ORIGINAL_LIVE_PROGRESS_FLAG === undefined) {
    delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
  } else {
    process.env.HOMA_LIVE_PROGRESS_ENABLED =
      ORIGINAL_LIVE_PROGRESS_FLAG;
  }
});

assert.ok(ITEM);
const PROMPT = personalizeStatement("Maya", ITEM.item);

function checkIn(
  overrides: Partial<ProgressCheckInRecord> = {},
): ProgressCheckInRecord {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    childId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    childName: "Maya",
    familyId: FAMILY_ID,
    purpose: "whole_map_refresh",
    scope: {},
    state: "active",
    ownerMemberUserId: MEMBER_ID,
    ownerDisplayName: "Elena",
    recipientMemberUserId: MEMBER_ID,
    recipientDisplayName: "Elena",
    revision: 1,
    currentItemId: "math.counts-to-5",
    currentDeliveryId: null,
    episodeId: "episode-1",
    pendingRuntimeSessionId: "runtime-1",
    pendingTurnId: "turn-1",
    pauseReason: null,
    openedAt: NOW.toISOString(),
    pausedAt: null,
    completedAt: null,
    stoppedAt: null,
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function attempt(
  overrides: Partial<DeliveryAttempt> = {},
): DeliveryAttempt {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    familyId: FAMILY_ID,
    episodeId: "episode-1",
    messageId: "22222222-2222-4222-8222-222222222222",
    taskRunId: null,
    memberUserId: MEMBER_ID,
    channel: "sms",
    destination: "+15550000001",
    providerThreadKey: "thread-1",
    existingStatus: "pending",
    shouldSend: true,
    ...overrides,
  };
}

function dependencies(input: {
  checkIns?: ProgressCheckInRecord[];
  onBind?: () => void;
  onOpen?: () => void;
  onPause?: () => void;
} = {}): ProgressDeliveryBindingDependencies {
  return {
    listFamilyCheckIns: async () => input.checkIns ?? [checkIn()],
    bindDelivery: async (_context, bindInput) => {
      input.onBind?.();
      return {
        status: "bound",
        checkIn: checkIn({
          currentDeliveryId: bindInput.deliveryId,
        }),
      };
    },
    pauseUndeliveredPrompt: async (_context, pauseInput) => {
      input.onPause?.();
      return {
        status: "paused",
        checkIn: checkIn({
          state: "paused",
          pauseReason: pauseInput.reason,
          pendingRuntimeSessionId: null,
          pendingTurnId: null,
          pausedAt: NOW.toISOString(),
        }),
        prompt: {
          checkInId: checkIn().id,
          revision: 2,
          childId: checkIn().childId,
          childName: "Maya",
          itemId: "math.counts-to-5",
          personalizedStatement: PROMPT,
          subjectDisplayName: "Math",
          state: "paused",
          ownerDisplayName: "Elena",
        },
      };
    },
    openReplyLoop: async () => {
      input.onOpen?.();
    },
  };
}

describe("trusted progress delivery markers", () => {
  it("lets web bind a card prompt without duplicated terminal prose", async () => {
    const result =
      await bindProgressCheckInAfterSuccessfulDelivery(
        {
          attempt: attempt({
            channel: "web",
            destination: `member:${MEMBER_ID}`,
          }),
          deliverySucceeded: true,
          deliveryOutcome: "sent",
          runtimeSessionId: "runtime-1",
          turnId: "turn-1",
          now: NOW,
        },
        dependencies(),
      );

    assert.equal(result.status, "bound");
  });

  it("requires exact prompt text for SMS and email", async () => {
    for (const channel of ["sms", "email"] as const) {
      const exact =
        await bindProgressCheckInAfterSuccessfulDelivery(
          {
            attempt: attempt({ channel }),
            deliveryOutcome: "sent",
            runtimeSessionId: "runtime-1",
            turnId: "turn-1",
            deliveredContent: `One question: ${PROMPT}`,
            now: NOW,
          },
          dependencies(),
        );
      assert.equal(exact.status, "bound");

      for (const deliveredContent of [
        undefined,
        "A different question",
      ]) {
        let binds = 0;
        const mismatch =
          await bindProgressCheckInAfterSuccessfulDelivery(
            {
              attempt: attempt({ channel }),
              deliveryOutcome: "sent",
              runtimeSessionId: "runtime-1",
              turnId: "turn-1",
              ...(deliveredContent
                ? { deliveredContent }
                : {}),
              now: NOW,
            },
            dependencies({
              onBind: () => {
                binds += 1;
              },
            }),
          );
        assert.deepEqual(mismatch, {
          status: "no_unique_prompt",
        });
        assert.equal(binds, 0);
      }
    }
  });

  it("refuses a fresh marker mismatch without binding", async () => {
    let bindCalls = 0;
    const result =
      await bindProgressCheckInAfterSuccessfulDelivery(
        {
          attempt: attempt(),
          deliverySucceeded: true,
          deliveryOutcome: "sent",
          runtimeSessionId: "runtime-other",
          turnId: "turn-1",
          now: NOW,
        },
        dependencies({
          onBind: () => {
            bindCalls += 1;
          },
        }),
      );

    assert.deepEqual(result, { status: "no_unique_prompt" });
    assert.equal(bindCalls, 0);
  });

  it("pauses an uncertain submission without binding or opening", async () => {
    let binds = 0;
    let opens = 0;
    let pauses = 0;
    const result =
      await bindProgressCheckInAfterSuccessfulDelivery(
        {
          attempt: attempt(),
          deliverySucceeded: true,
          deliveryOutcome: "uncertain",
          runtimeSessionId: "runtime-1",
          turnId: "turn-1",
          now: NOW,
        },
        dependencies({
          onBind: () => {
            binds += 1;
          },
          onOpen: () => {
            opens += 1;
          },
          onPause: () => {
            pauses += 1;
          },
        }),
      );

    assert.deepEqual(result, {
      status: "delivery_paused",
      reason: "delivery_uncertain",
    });
    assert.equal(binds, 0);
    assert.equal(opens, 0);
    assert.equal(pauses, 1);
  });

  it("never binds a hard delivery failure", async () => {
    let bindCalls = 0;
    let openCalls = 0;
    let pauseCalls = 0;
    const result =
      await bindProgressCheckInAfterSuccessfulDelivery(
        {
          attempt: attempt(),
          deliverySucceeded: true,
          deliveryOutcome: "failed",
          runtimeSessionId: "runtime-1",
          turnId: "turn-1",
          now: NOW,
        },
        dependencies({
          onBind: () => {
            bindCalls += 1;
          },
          onOpen: () => {
            openCalls += 1;
          },
          onPause: () => {
            pauseCalls += 1;
          },
        }),
      );

    assert.deepEqual(result, {
      status: "delivery_paused",
      reason: "delivery_failed",
    });
    assert.equal(bindCalls, 0);
    assert.equal(openCalls, 0);
    assert.equal(pauseCalls, 1);
  });
});
