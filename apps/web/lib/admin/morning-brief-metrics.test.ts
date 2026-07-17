import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countPossibleMorningBriefInterest,
  summarizeTaskPromptOutcomes,
} from "./morning-brief-metrics";

const SENT_AT = new Date("2026-07-16T13:00:00.000Z");

describe("morning brief admin metrics", () => {
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
