import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderRecentActivityDigest } from "./recent-activity";

/**
 * The phone line's bounded "recent activity" digest (issue #176, CG-03,
 * item 5): plain sentences the call assistant can reference naturally.
 * This is the pure rendering half; loadRecentActivityDigest owns the
 * bounded database read.
 */

describe("renderRecentActivityDigest", () => {
  it("returns an empty string when nothing happened in the window", () => {
    const digest = renderRecentActivityDigest({
      materials: [],
      scheduled: [],
      hours: [],
      today: "2026-07-26",
    });
    assert.equal(digest, "");
  });

  it("names a finalized material for a specific child, today", () => {
    const digest = renderRecentActivityDigest({
      materials: [
        { title: "Counting worksheet", childName: "Maya", status: "final", createdAt: "2026-07-26T10:00:00Z" },
      ],
      scheduled: [],
      hours: [],
      today: "2026-07-26",
    });
    assert.match(digest, /Finished Maya's "Counting worksheet" today\./);
  });

  it("names a draft material as started, not finished", () => {
    const digest = renderRecentActivityDigest({
      materials: [
        { title: "Volcano diagram", childName: null, status: "draft", createdAt: "2026-07-25T10:00:00Z" },
      ],
      scheduled: [],
      hours: [],
      today: "2026-07-26",
    });
    assert.match(digest, /Started a "Volcano diagram" yesterday\./);
  });

  it("names a scheduled plan activity with the real subject and date", () => {
    const digest = renderRecentActivityDigest({
      materials: [],
      scheduled: [{ childName: "Leo", subjectId: "math", scheduledDate: "2026-07-28" }],
      hours: [],
      today: "2026-07-26",
    });
    assert.match(digest, /Leo's Math activity was scheduled for 2026-07-28\./);
  });

  it("names logged hours for a child, and for the whole family when childless", () => {
    const digest = renderRecentActivityDigest({
      materials: [],
      scheduled: [],
      hours: [
        { childName: "Maya", subject: "reading", minutes: 30, happenedOn: "2026-07-26" },
        { childName: null, subject: "co-op", minutes: 90, happenedOn: "2026-07-24" },
      ],
      today: "2026-07-26",
    });
    assert.match(digest, /Maya logged 30 minutes of reading today\./);
    assert.match(digest, /The family logged 90 minutes of co-op 2 days ago\./);
  });

  it("leads with a plain framing line, never a mechanical 'digest' word to say aloud", () => {
    const digest = renderRecentActivityDigest({
      materials: [{ title: "X", childName: null, status: "final", createdAt: "2026-07-26T00:00:00Z" }],
      scheduled: [],
      hours: [],
      today: "2026-07-26",
    });
    assert.match(digest, /^Recent activity \(last 72 hours, for natural reference only\):/);
  });
});
