import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_FAMILY_NAME,
  formatHandledLine,
  formatSignupsLine,
  formatTroubleHeadline,
} from "./digest-format";

describe("digest signups line", () => {
  it("reports quiet days plainly", () => {
    assert.equal(
      formatSignupsLine([]),
      "No new signups in the last 24 hours.",
    );
  });

  it("lists named signups as before", () => {
    assert.equal(
      formatSignupsLine(["The Cooper Family", "Webb"]),
      "2 new signups: The Cooper Family, Webb.",
    );
  });

  it("collapses unnamed signups into one stalled count", () => {
    const names = [
      "Bransom Family",
      DEFAULT_FAMILY_NAME,
      DEFAULT_FAMILY_NAME,
      "Webb",
      DEFAULT_FAMILY_NAME,
    ];
    assert.equal(
      formatSignupsLine(names),
      "5 new signups: Bransom Family, Webb, plus 3 that stopped before naming their family.",
    );
  });

  it("handles days where nobody finished the family step", () => {
    assert.equal(
      formatSignupsLine([DEFAULT_FAMILY_NAME, DEFAULT_FAMILY_NAME]),
      "2 new signups, all stopped before naming their family.",
    );
    assert.equal(
      formatSignupsLine([DEFAULT_FAMILY_NAME]),
      "1 new signup, stopped before naming their family.",
    );
  });
});

describe("digest trouble headline", () => {
  it("stays all clear when nothing broke", () => {
    assert.equal(formatTroubleHeadline(0, 0), "Nothing broke in the last 24 hours.");
  });

  it("counts only alerts that still need a look", () => {
    assert.equal(formatTroubleHeadline(1, 0), "1 delivery problem needs a look.");
    assert.equal(formatTroubleHeadline(3, 2), "3 delivery problems need a look.");
  });

  it("never re-alarms on a morning where every alert was already handled", () => {
    // The 2026-07-18 digest: three alerts, all marked handled the
    // evening before, must not read as "3 problems need a look".
    assert.equal(formatTroubleHeadline(0, 3), "Nothing new needs a look.");
  });
});

describe("digest handled line", () => {
  it("says nothing when nothing was handled", () => {
    assert.equal(formatHandledLine(0), null);
  });

  it("reports handled alerts as handled, not as trouble", () => {
    assert.equal(
      formatHandledLine(1),
      "1 alert from the last 24 hours was already marked handled in the console.",
    );
    assert.equal(
      formatHandledLine(3),
      "3 alerts from the last 24 hours were already marked handled in the console.",
    );
  });
});
