import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadRecentActivityDigest, renderRecentActivityDigest } from "./recent-activity";

/**
 * The phone line's bounded "recent activity" digest (issue #176, CG-03,
 * item 5): plain sentences the call assistant can reference naturally.
 * The pure rendering half is tested first; the loadRecentActivityDigest
 * tests below are the read-path regression guard for issue #256 (the
 * schedule-cascade change must never break the digest's
 * plan_activity_schedule read or its row shape).
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

/**
 * The read path (issue #256 regression guard): a fake postgres tag in
 * the same convention as lib/map/plan-schedule-cascade.test.ts, so the
 * digest's plan_activity_schedule read is pinned to the row shape the
 * schedule writes produce and to the family_id tenancy predicate.
 */

const FAMILY = "11111111-1111-1111-1111-111111111111";

interface Recorded {
  text: string;
  args: unknown[];
}

function fakeSql(options: { scheduleFails?: boolean } = {}) {
  const statements: Recorded[] = [];
  const tag = (strings: TemplateStringsArray, ...args: unknown[]): Promise<unknown[]> => {
    const text = strings.join(" ? ").replace(/\s+/gu, " ").trim();
    statements.push({ text, args });
    if (/from public\.materials/u.test(text)) {
      return Promise.resolve([
        {
          title: "Counting worksheet",
          child_name: "Maya",
          status: "final",
          created_at: "2026-07-26T10:00:00Z",
        },
      ]);
    }
    if (/from public\.hours_log/u.test(text)) {
      return Promise.resolve([
        { child_name: "Maya", subject: "reading", minutes: 30, happened_on: "2026-07-26" },
      ]);
    }
    if (/from public\.plan_activity_schedule/u.test(text)) {
      if (options.scheduleFails) {
        return Promise.reject(new Error("relation does not exist"));
      }
      return Promise.resolve([
        { child_name: "Leo", subject_id: "math", scheduled_date: "2026-07-28" },
      ]);
    }
    return Promise.resolve([]);
  };
  return { sql: tag, statements };
}

describe("loadRecentActivityDigest read path", () => {
  it("reads plan_activity_schedule rows into the spoken digest", async () => {
    const db = fakeSql();
    const digest = await loadRecentActivityDigest(
      FAMILY,
      "2026-07-26",
      db.sql as Parameters<typeof loadRecentActivityDigest>[2],
    );
    assert.match(digest, /Leo's Math activity was scheduled for 2026-07-28\./);
    assert.match(digest, /Finished Maya's "Counting worksheet" today\./);
    assert.match(digest, /Maya logged 30 minutes of reading today\./);
  });

  it("scopes the schedule read to the family and joins the child's name", () => {
    const db = fakeSql();
    return loadRecentActivityDigest(
      FAMILY,
      "2026-07-26",
      db.sql as Parameters<typeof loadRecentActivityDigest>[2],
    ).then(() => {
      const schedule = db.statements.find((statement) =>
        /from public\.plan_activity_schedule/u.test(statement.text),
      );
      assert.ok(schedule, "the schedule read must run");
      assert.match(schedule.text, /s\.family_id = \?/u);
      assert.match(schedule.text, /join public\.children c on c\.id = s\.child_id/u);
      assert.ok(schedule.args.includes(FAMILY), "family_id must ride the query");
    });
  });

  it("fails closed to the other sources when the schedule read errors", async () => {
    const db = fakeSql({ scheduleFails: true });
    const digest = await loadRecentActivityDigest(
      FAMILY,
      "2026-07-26",
      db.sql as Parameters<typeof loadRecentActivityDigest>[2],
    );
    assert.doesNotMatch(digest, /scheduled/);
    assert.match(digest, /Finished Maya's "Counting worksheet" today\./);
  });
});
