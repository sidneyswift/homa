import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countPossibleMorningBriefInterest,
  summarizeMorningOfferFunnel,
  summarizeTaskPromptOutcomes,
} from "./morning-brief-metrics";

const SENT_AT = new Date("2026-07-16T13:00:00.000Z");

describe("morning brief admin metrics", () => {
  it("shows unclassified legacy replies without turning no data into zero acceptance", () => {
    const now = new Date("2026-07-17T16:00:00.000Z");
    const summary = summarizeMorningOfferFunnel(
      [
        ...Array.from({ length: 8 }, () => ({
          state: "resolved" as const,
          expiresAt: new Date("2026-07-17T12:00:00.000Z"),
          outcome: null,
          fulfilled: false,
        })),
        ...Array.from({ length: 30 }, () => ({
          state: "open" as const,
          expiresAt: new Date("2026-07-18T12:00:00.000Z"),
          outcome: null,
          fulfilled: false,
        })),
      ],
      now,
    );

    assert.deepEqual(summary, {
      deliveredOffers: 38,
      linkedReplies: 8,
      waiting: 30,
      noLinkedReply: 0,
      maturedOffers: 8,
      decisions: 0,
      accepted: 0,
      declined: 0,
      answered: 0,
      unclassified: 8,
      fulfilled: 0,
    });
  });

  it("keeps the causal funnel and no-reply side buckets internally consistent", () => {
    const now = new Date("2026-07-17T16:00:00.000Z");
    const summary = summarizeMorningOfferFunnel(
      [
        {
          state: "resolved",
          expiresAt: now,
          outcome: "accepted",
          fulfilled: true,
        },
        {
          state: "resolved",
          expiresAt: now,
          outcome: "accepted",
          fulfilled: false,
        },
        {
          state: "resolved",
          expiresAt: now,
          outcome: "declined",
          fulfilled: true,
        },
        {
          state: "resolved",
          expiresAt: now,
          outcome: "answered",
          fulfilled: false,
        },
        {
          state: "open",
          expiresAt: new Date("2026-07-17T17:00:00.000Z"),
          outcome: null,
          fulfilled: false,
        },
        {
          state: "open",
          expiresAt: new Date("2026-07-17T15:00:00.000Z"),
          outcome: null,
          fulfilled: false,
        },
        {
          state: "expired",
          expiresAt: new Date("2026-07-17T14:00:00.000Z"),
          outcome: null,
          fulfilled: false,
        },
      ],
      now,
    );

    assert.deepEqual(summary, {
      deliveredOffers: 7,
      linkedReplies: 4,
      waiting: 1,
      noLinkedReply: 2,
      maturedOffers: 6,
      decisions: 3,
      accepted: 2,
      declined: 1,
      answered: 1,
      unclassified: 0,
      fulfilled: 1,
    });
  });

  it("splits sent and resolved outcomes by joined task kind", () => {
    const metrics = summarizeTaskPromptOutcomes([
      {
        taskKind: "morning_brief",
        sentInRange: true,
        resolvedInRange: true,
        outcome: "accepted",
      },
      {
        taskKind: "morning_brief",
        sentInRange: true,
        resolvedInRange: true,
        outcome: "declined",
      },
      {
        taskKind: "morning_brief",
        sentInRange: true,
        resolvedInRange: true,
        outcome: "answered",
      },
      {
        taskKind: "morning_brief",
        sentInRange: true,
        resolvedInRange: false,
        outcome: null,
      },
      {
        taskKind: "journal_prompt",
        sentInRange: true,
        resolvedInRange: true,
        outcome: "answered",
      },
    ]);

    assert.deepEqual(metrics.morning_brief, {
      sentOffers: 4,
      resolvedOffers: 3,
      accepted: 1,
      declined: 1,
      answered: 1,
      acceptanceDenominator: 2,
    });
    assert.deepEqual(metrics.journal_prompt, {
      sentOffers: 1,
      resolvedOffers: 1,
      accepted: 0,
      declined: 0,
      answered: 1,
      acceptanceDenominator: 0,
    });
  });

  it("counts only unlinked same-episode messages inside the four-hour window as possible interest", () => {
    const count = countPossibleMorningBriefInterest([
      {
        sentMorningBriefAt: SENT_AT,
        messageCreatedAt: new Date("2026-07-16T16:59:59.000Z"),
        repliedDeliveryId: null,
      },
      {
        sentMorningBriefAt: SENT_AT,
        messageCreatedAt: new Date("2026-07-16T13:00:00.000Z"),
        repliedDeliveryId: null,
      },
      {
        sentMorningBriefAt: SENT_AT,
        messageCreatedAt: new Date("2026-07-16T13:30:00.000Z"),
        repliedDeliveryId: "delivery-linked",
      },
      {
        sentMorningBriefAt: null,
        messageCreatedAt: new Date("2026-07-16T13:30:00.000Z"),
        repliedDeliveryId: null,
      },
      {
        sentMorningBriefAt: SENT_AT,
        messageCreatedAt: new Date("2026-07-16T17:00:01.000Z"),
        repliedDeliveryId: null,
      },
    ]);

    assert.equal(count, 2);
  });
});
