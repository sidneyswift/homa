import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  planStrandedFollowups,
  STRANDED_MIN_AGE_HOURS,
  type StrandedChainRow,
} from "./stranded-chains";

/**
 * This plan mails real families about work they did not finish, so the
 * tests are mostly about the ways it could turn into nagging (gh#197).
 */

const NOW = "2026-07-30T14:00:00.000Z";
const YESTERDAY = "2026-07-29T19:00:00.000Z"; // 19h old
const THIS_MORNING = "2026-07-30T09:00:00.000Z"; // 5h old

function row(over: Partial<StrandedChainRow> = {}): StrandedChainRow {
  return {
    familyId: "fam-1",
    email: "robin@example.com",
    firstName: "Robin",
    materialId: "mat-1",
    title: "Counting to twenty",
    createdAtIso: YESTERDAY,
    reviewPass: true,
    familyHasFinal: false,
    ...over,
  };
}

describe("one family, one message", () => {
  it("sends a single message however many drafts are stranded", () => {
    // The Chan family had NINE stranded drafts. Nine emails is the exact
    // behavior the not-nagging ruling exists to prevent.
    const rows = Array.from({ length: 9 }, (_, i) =>
      row({ materialId: `mat-${i}`, title: `Sheet ${i}` }),
    );
    const plan = planStrandedFollowups(rows, NOW, new Set());
    assert.equal(plan.sends.length, 1);
    assert.equal(plan.sends[0].strandedCount, 9);
  });

  it("names the newest thing she made", () => {
    const plan = planStrandedFollowups(
      [
        row({ materialId: "old", createdAtIso: "2026-07-20T10:00:00.000Z" }),
        row({ materialId: "new", createdAtIso: "2026-07-29T20:00:00.000Z" }),
        row({ materialId: "mid", createdAtIso: "2026-07-25T10:00:00.000Z" }),
      ],
      NOW,
      new Set(),
    );
    assert.equal(plan.sends[0].materialId, "new");
    assert.equal(plan.sends[0].strandedCount, 3);
  });

  it("never tells the same family twice, ever", () => {
    const plan = planStrandedFollowups([row()], NOW, new Set(["fam-1"]));
    assert.equal(plan.sends.length, 0);
    assert.equal(plan.skipped.family_already_told, 1);
  });

  it("mails several families separately", () => {
    const plan = planStrandedFollowups(
      [row({ familyId: "a" }), row({ familyId: "b" }), row({ familyId: "b" })],
      NOW,
      new Set(),
    );
    assert.equal(plan.sends.length, 2);
    assert.deepEqual(plan.sends.map((s) => s.familyId).sort(), ["a", "b"]);
  });
});

describe("what it refuses to surface", () => {
  it("stays quiet about work she may still be doing", () => {
    // A parent mid-revision at 11pm must never be emailed about the
    // thing she is actively working on.
    const plan = planStrandedFollowups(
      [row({ createdAtIso: THIS_MORNING })],
      NOW,
      new Set(),
    );
    assert.equal(plan.sends.length, 0);
    assert.equal(plan.skipped.too_recent, 1);
  });

  it("waits the full window and then sends", () => {
    const justUnder = new Date(
      Date.parse(NOW) - (STRANDED_MIN_AGE_HOURS - 1) * 3_600_000,
    ).toISOString();
    const justOver = new Date(
      Date.parse(NOW) - (STRANDED_MIN_AGE_HOURS + 1) * 3_600_000,
    ).toISOString();
    assert.equal(
      planStrandedFollowups([row({ createdAtIso: justUnder })], NOW, new Set())
        .sends.length,
      0,
    );
    assert.equal(
      planStrandedFollowups([row({ createdAtIso: justOver })], NOW, new Set())
        .sends.length,
      1,
    );
  });

  it("never surfaces work the quality check failed", () => {
    // Telling a parent about a sheet Homa itself judged not good enough
    // is worse than saying nothing.
    const plan = planStrandedFollowups(
      [row({ reviewPass: false })],
      NOW,
      new Set(),
    );
    assert.equal(plan.sends.length, 0);
    assert.equal(plan.skipped.review_failed, 1);
  });

  it("still surfaces work that was never reviewed", () => {
    // null is "no review ran", which is not a failure.
    const plan = planStrandedFollowups([row({ reviewPass: null })], NOW, new Set());
    assert.equal(plan.sends.length, 1);
  });

  it("skips a family with nowhere to write", () => {
    const plan = planStrandedFollowups(
      [row({ email: null }), row({ familyId: "f2", email: "  " })],
      NOW,
      new Set(),
    );
    assert.equal(plan.sends.length, 0);
    assert.equal(plan.skipped.no_email, 2);
  });

  it("drops a failed review before it can hold a family's slot", () => {
    // A family whose newest chain failed review should still hear about
    // the good older one, not be silenced by the bad newest.
    const plan = planStrandedFollowups(
      [
        row({ materialId: "bad", createdAtIso: "2026-07-29T22:00:00.000Z", reviewPass: false }),
        row({ materialId: "good", createdAtIso: "2026-07-29T18:00:00.000Z" }),
      ],
      NOW,
      new Set(),
    );
    assert.equal(plan.sends.length, 1);
    assert.equal(plan.sends[0].materialId, "good");
  });
});

describe("the plan is countable", () => {
  it("reports every reason as a number, even at zero", () => {
    const plan = planStrandedFollowups([], NOW, new Set());
    assert.deepEqual(plan.sends, []);
    for (const count of Object.values(plan.skipped)) assert.equal(count, 0);
  });

  it("uses one ledger kind, so already-told is a single lookup", () => {
    const plan = planStrandedFollowups([row()], NOW, new Set());
    assert.equal(plan.sends[0].ledgerKind, "materials_stranded");
  });

  it("treats an unreadable timestamp as too recent rather than sending", () => {
    const plan = planStrandedFollowups(
      [row({ createdAtIso: "whenever" })],
      NOW,
      new Set(),
    );
    assert.equal(plan.sends.length, 0);
    assert.equal(plan.skipped.too_recent, 1);
  });
});
