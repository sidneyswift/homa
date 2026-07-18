import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_FAMILY_NAME, formatSignupsLine } from "./digest-format";

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
