import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { weekdayCells } from "./time-zone";

/**
 * Focused on the month/year fields added for D17 (birthday on the
 * board, plans/2026-07-21-chat-first-onboarding.md §4.2): a bare
 * day-of-month cannot tell a birthday match from any other month's
 * same day, and a week spanning a year boundary must carry the right
 * year on each side of it.
 */
describe("weekdayCells", () => {
  it("carries the same month and year for an ordinary mid-month week", () => {
    // 2026-03-11 is a Wednesday; Mon 2026-03-09 .. Fri 2026-03-13.
    const cells = weekdayCells(new Date("2026-03-11T12:00:00Z"), "UTC");
    assert.deepEqual(
      cells.map((cell) => [cell.month, cell.year, cell.dayOfMonth]),
      [
        [3, 2026, 9],
        [3, 2026, 10],
        [3, 2026, 11],
        [3, 2026, 12],
        [3, 2026, 13],
      ],
    );
  });

  it("carries the correct month and year across a month boundary", () => {
    // 2026-04-01 is a Wednesday; Mon 2026-03-30 .. Fri 2026-04-03.
    const cells = weekdayCells(new Date("2026-04-01T12:00:00Z"), "UTC");
    assert.deepEqual(
      cells.map((cell) => [cell.month, cell.year, cell.dayOfMonth]),
      [
        [3, 2026, 30],
        [3, 2026, 31],
        [4, 2026, 1],
        [4, 2026, 2],
        [4, 2026, 3],
      ],
    );
  });

  it("carries the correct year across a year boundary", () => {
    // 2025-12-31 is a Wednesday; Mon 2025-12-29 .. Fri 2026-01-02.
    const cells = weekdayCells(new Date("2025-12-31T12:00:00Z"), "UTC");
    assert.deepEqual(
      cells.map((cell) => [cell.month, cell.year, cell.dayOfMonth]),
      [
        [12, 2025, 29],
        [12, 2025, 30],
        [12, 2025, 31],
        [1, 2026, 1],
        [1, 2026, 2],
      ],
    );
  });
});
