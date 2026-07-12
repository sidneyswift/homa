import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateDeliveryOutcomes,
  replyContractForProgressCheckIn,
  replyContractForReactiveMessage,
  replyContractForTask,
  type DeliveryOutcome,
} from "./delivery-policy";

describe("conversation delivery aggregation", () => {
  it("reports partial when only one parent receives the family message", () => {
    const outcomes: DeliveryOutcome[] = [
      { channel: "sms", delivered: true },
      { channel: "sms", delivered: false },
    ];

    assert.deepEqual(aggregateDeliveryOutcomes(outcomes), {
      status: "partial",
      deliveredChannel: "sms",
      deliveredCount: 1,
      failedCount: 1,
    });
  });

  it("reports failed only when no intended recipient receives the message", () => {
    assert.deepEqual(
      aggregateDeliveryOutcomes([
        { channel: "sms", delivered: false },
        { channel: "email", delivered: false },
      ]),
      {
        status: "failed",
        deliveredChannel: null,
        deliveredCount: 0,
        failedCount: 2,
      },
    );
  });

  it("keeps the successful channel when every delivery lands", () => {
    assert.deepEqual(
      aggregateDeliveryOutcomes([
        { channel: "sms", delivered: true },
        { channel: "sms", delivered: true },
      ]),
      {
        status: "done",
        deliveredChannel: "sms",
        deliveredCount: 2,
        failedCount: 0,
      },
    );
  });

  it("preserves unknown provider acceptance instead of calling it failed", () => {
    assert.deepEqual(
      aggregateDeliveryOutcomes([
        { channel: "sms", delivered: false, uncertain: true },
      ]),
      {
        status: "uncertain",
        deliveredChannel: null,
        deliveredCount: 0,
        failedCount: 0,
      },
    );
  });

  it("distinguishes partial uncertainty from confirmed partial failure", () => {
    assert.deepEqual(
      aggregateDeliveryOutcomes([
        { channel: "sms", delivered: true },
        { channel: "sms", delivered: false, uncertain: true },
      ]),
      {
        status: "partial_uncertain",
        deliveredChannel: "sms",
        deliveredCount: 1,
        failedCount: 0,
      },
    );
  });
});

describe("reactive message reply contracts", () => {
  it("opens a free-text loop only when Homa actually asks a question", () => {
    assert.deepEqual(
      replyContractForReactiveMessage("Which page should I make first?"),
      {
        kind: "free_text",
        promptKey: "reactive-question",
        expiresAfterMs: 24 * 60 * 60_000,
      },
    );
    assert.equal(
      replyContractForReactiveMessage("Your page is ready."),
      null,
    );
  });
});

describe("progress check-in reply contracts", () => {
  it("keys the bounded loop to the exact check-in revision", () => {
    assert.deepEqual(
      replyContractForProgressCheckIn("check-in-1", 7),
      {
        kind: "choice",
        promptKey: "progress-check-in:check-in-1:revision:7",
        expiresAfterMs: 24 * 60 * 60_000,
      },
    );
  });
});

describe("scheduled message reply contracts", () => {
  it("gives every morning-brief recipient an independent yes/no open loop", () => {
    assert.deepEqual(
      replyContractForTask("morning_brief", "Want the quick game?"),
      {
      kind: "yes_no",
      promptKey: "morning-brief-offer",
      expiresAfterMs: 24 * 60 * 60_000,
      },
    );
  });

  it("does not open a reply loop when the brief made no offer", () => {
    assert.equal(
      replyContractForTask(
        "morning_brief",
        "Three stop-and-go variations are ready in Homa's tasks.",
      ),
      null,
    );
  });

  it("uses free text for evening check-ins", () => {
    assert.deepEqual(replyContractForTask("journal_prompt", "How did today go?"), {
      kind: "free_text",
      promptKey: "evening-check-in",
      expiresAfterMs: 24 * 60 * 60_000,
    });
  });

  it("does not invent an open loop for a custom task", () => {
    assert.equal(replyContractForTask("custom", "Saved result"), null);
  });
});
