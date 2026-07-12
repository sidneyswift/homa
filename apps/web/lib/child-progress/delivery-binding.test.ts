import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type {
  DeliveryAttempt,
} from "../conversation-continuity/delivery-ledger";
import {
  bindProgressCheckInAfterSuccessfulDelivery,
  selectSingleUnboundProgressCheckIn,
  type ProgressDeliveryBindingDependencies,
} from "./delivery-binding";
import type {
  ProgressCheckInContext,
  ProgressCheckInRecord,
} from "./types";

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEMBER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = new Date("2026-07-11T21:00:00.000Z");
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
    revision: 3,
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

describe("unbound progress prompt selection", () => {
  it("requires exact nullable recipient and trusted marker identity", () => {
    const unpinned = checkIn({
      recipientMemberUserId: null,
      recipientDisplayName: null,
    });
    assert.equal(
      selectSingleUnboundProgressCheckIn([unpinned], {
        familyId: FAMILY_ID,
        memberUserId: null,
        episodeId: "episode-1",
        runtimeSessionId: "runtime-1",
        turnId: "turn-1",
      })?.id,
      unpinned.id,
    );
    assert.equal(
      selectSingleUnboundProgressCheckIn([unpinned], {
        familyId: FAMILY_ID,
        memberUserId: MEMBER_ID,
        episodeId: "episode-1",
        runtimeSessionId: "runtime-1",
        turnId: "turn-1",
      }),
      null,
    );
  });

  it("does not guess when multiple prompts match", () => {
    assert.equal(
      selectSingleUnboundProgressCheckIn(
        [
          checkIn(),
          checkIn({
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            childId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          }),
        ],
        {
          familyId: FAMILY_ID,
          memberUserId: MEMBER_ID,
          episodeId: "episode-1",
          runtimeSessionId: "runtime-1",
          turnId: "turn-1",
        },
      ),
      null,
    );
  });
});

describe("post-delivery progress binding", () => {
  it("performs no ChildProgress reads or writes for ordinary delivery while disabled", async () => {
    for (const flag of [undefined, "false", "TRUE"]) {
      if (flag === undefined) {
        delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
      } else {
        process.env.HOMA_LIVE_PROGRESS_ENABLED = flag;
      }
      for (const channel of ["web", "sms", "email"] as const) {
        const calls = {
          list: 0,
          bind: 0,
          pause: 0,
          open: 0,
        };
        const current = checkIn();
        const result =
          await bindProgressCheckInAfterSuccessfulDelivery(
            {
              attempt: attempt({ channel }),
              deliveryOutcome: "sent",
              runtimeSessionId: "runtime-1",
              turnId: "turn-1",
              deliveredContent:
                "Maya counts out loud from 1 to 5, mostly in order",
              now: NOW,
            },
            {
              listFamilyCheckIns: async () => {
                calls.list += 1;
                return [current];
              },
              bindDelivery: async () => {
                calls.bind += 1;
                return {
                  status: "bound",
                  checkIn: current,
                };
              },
              pauseUndeliveredPrompt: async () => {
                calls.pause += 1;
                return { status: "no_active_check_in" };
              },
              openReplyLoop: async () => {
                calls.open += 1;
              },
            },
          );

        assert.deepEqual(result, { status: "disabled" });
        assert.deepEqual(calls, {
          list: 0,
          bind: 0,
          pause: 0,
          open: 0,
        });
      }
    }
    process.env.HOMA_LIVE_PROGRESS_ENABLED = "true";
  });

  it("binds before opening the exact revision loop", async () => {
    const order: string[] = [];
    let capturedContext: ProgressCheckInContext | null = null;
    const current = checkIn();
    const dependencies: ProgressDeliveryBindingDependencies = {
      listFamilyCheckIns: async () => [current],
      bindDelivery: async (context, input) => {
        order.push("bind");
        capturedContext = context;
        return {
          status: "bound",
          checkIn: {
            ...current,
            currentDeliveryId: input.deliveryId,
          },
        };
      },
      pauseUndeliveredPrompt: async () => ({
        status: "no_active_check_in",
      }),
      openReplyLoop: async (input) => {
        order.push("open");
        assert.equal(
          input.contract.promptKey,
          `progress-check-in:${current.id}:revision:3`,
        );
      },
    };

    const result =
      await bindProgressCheckInAfterSuccessfulDelivery(
        {
          attempt: attempt(),
          deliveryOutcome: "sent",
          runtimeSessionId: "runtime-1",
          turnId: "turn-1",
          deliveredContent:
            "Maya counts out loud from 1 to 5, mostly in order",
          now: NOW,
        },
        dependencies,
      );

    assert.equal(result.status, "bound");
    assert.deepEqual(order, ["bind", "open"]);
    assert.ok(capturedContext);
    assert.equal(
      (capturedContext as ProgressCheckInContext).runtimeSessionId,
      "runtime-1",
    );
    assert.equal(
      (capturedContext as ProgressCheckInContext).turnId,
      "turn-1",
    );
  });

  it("binds a text prompt restated as a natural question", async () => {
    const order: string[] = [];
    const current = checkIn();
    const result =
      await bindProgressCheckInAfterSuccessfulDelivery(
        {
          attempt: attempt(),
          deliveryOutcome: "sent",
          runtimeSessionId: "runtime-1",
          turnId: "turn-1",
          deliveredContent:
            "Quick check: does Maya count out loud from 1 to 5, mostly in order?",
          now: NOW,
        },
        {
          listFamilyCheckIns: async () => [current],
          bindDelivery: async (_context, input) => {
            order.push("bind");
            return {
              status: "bound",
              checkIn: {
                ...current,
                currentDeliveryId: input.deliveryId,
              },
            };
          },
          pauseUndeliveredPrompt: async () => ({
            status: "no_active_check_in",
          }),
          openReplyLoop: async () => {
            order.push("open");
          },
        },
      );

    assert.equal(result.status, "bound");
    assert.deepEqual(order, ["bind", "open"]);
  });

  it("never binds a text that does not carry the question", async () => {
    let binds = 0;
    const result =
      await bindProgressCheckInAfterSuccessfulDelivery(
        {
          attempt: attempt(),
          deliveryOutcome: "sent",
          runtimeSessionId: "runtime-1",
          turnId: "turn-1",
          deliveredContent:
            "Great, moving on to reading next time.",
          now: NOW,
        },
        {
          listFamilyCheckIns: async () => [checkIn()],
          bindDelivery: async () => {
            binds += 1;
            return { status: "wrong_delivery" };
          },
          pauseUndeliveredPrompt: async () => ({
            status: "no_active_check_in",
          }),
          openReplyLoop: async () => {},
        },
      );

    assert.deepEqual(result, { status: "no_unique_prompt" });
    assert.equal(binds, 0);
  });

  it("opens no loop when strict binding refuses", async () => {
    let opens = 0;
    const result =
      await bindProgressCheckInAfterSuccessfulDelivery(
        {
          attempt: attempt(),
          deliveryOutcome: "sent",
          runtimeSessionId: "runtime-1",
          turnId: "turn-1",
          deliveredContent:
            "Maya counts out loud from 1 to 5, mostly in order",
          now: NOW,
        },
        {
          listFamilyCheckIns: async () => [checkIn()],
          bindDelivery: async () => ({ status: "stale_prompt" }),
          pauseUndeliveredPrompt: async () => ({
            status: "no_active_check_in",
          }),
          openReplyLoop: async () => {
            opens += 1;
          },
        },
      );

    assert.deepEqual(result, {
      status: "binding_refused",
      reason: "stale_prompt",
    });
    assert.equal(opens, 0);
  });

  it("reopens an already-bound exact delivery without rematching markers", async () => {
    let binds = 0;
    let opens = 0;
    const delivery = attempt();
    const result =
      await bindProgressCheckInAfterSuccessfulDelivery(
        {
          attempt: delivery,
          deliveryOutcome: "sent",
          runtimeSessionId: "different-runtime",
          turnId: "different-turn",
          now: NOW,
        },
        {
          listFamilyCheckIns: async () => [
            checkIn({ currentDeliveryId: delivery.id }),
          ],
          bindDelivery: async () => {
            binds += 1;
            return { status: "wrong_delivery" };
          },
          pauseUndeliveredPrompt: async () => ({
            status: "no_active_check_in",
          }),
          openReplyLoop: async () => {
            opens += 1;
          },
        },
      );

    assert.equal(result.status, "bound");
    assert.equal(binds, 0);
    assert.equal(opens, 1);
  });
});
