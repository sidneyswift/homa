import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FAMILY_MEMORY_CHAR_BUDGET,
  MEMORY_COMPACTION_TRIGGER_RATIO,
  memoryUsageChars,
  selectPinnedMemories,
  type MemoryRow,
} from "./agent-memory";

/**
 * The pinning split is the load-bearing half of the render-time budget
 * (founder ruling 2026-07-20, memory-render-time-budget). Storage is
 * unbounded now, so these are the invariants standing between "Homa knows
 * a lot about this family" and "Homa silently forgot something a parent
 * told her": nothing may be dropped, the prompt must stay bounded, and the
 * pinned set must not flicker between turns.
 *
 * The old write-time gate shipped with no tests at all and never once ran
 * in production. That is exactly how it stayed broken.
 */

let seq = 0;

function memory(overrides: Partial<MemoryRow> & { content: string }): MemoryRow {
  seq += 1;
  return {
    id: overrides.id ?? `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    child_id: overrides.child_id ?? null,
    kind: overrides.kind ?? "fact",
    content: overrides.content,
    source: overrides.source ?? "homa",
    created_at: overrides.created_at ?? `2026-07-${String((seq % 28) + 1).padStart(2, "0")} 12:00:00+00`,
  };
}

/** n rows of `len` characters each, oldest first. */
function fill(count: number, len: number): MemoryRow[] {
  return Array.from({ length: count }, (_, index) =>
    memory({
      content: `${String(index).padStart(3, "0")}${"x".repeat(Math.max(0, len - 3))}`,
      created_at: `2026-07-01 12:00:${String(index).padStart(2, "0")}+00`,
    }),
  );
}

describe("selectPinnedMemories", () => {
  it("pins everything when the family fits inside the budget", () => {
    const rows = fill(10, 100);
    const { pinned, overflow, pinnedChars } = selectPinnedMemories(rows);

    assert.equal(pinned.length, 10);
    assert.equal(overflow.length, 0);
    assert.equal(pinnedChars, 1000);
  });

  it("never drops a row: every input lands in exactly one bucket", () => {
    const rows = fill(120, 200); // 24,000 chars, six times the budget
    const { pinned, overflow } = selectPinnedMemories(rows);

    const seen = new Set([...pinned, ...overflow].map((row) => row.id));
    assert.equal(seen.size, rows.length, "a row went missing in the split");
    assert.equal(pinned.length + overflow.length, rows.length);
    assert.ok(overflow.length > 0, "this fixture must overflow to be meaningful");
  });

  it("keeps the pinned block inside the prompt budget", () => {
    const rows = fill(120, 200);
    const { pinned, pinnedChars } = selectPinnedMemories(rows);

    assert.equal(pinnedChars, memoryUsageChars(pinned));
    assert.ok(
      pinnedChars <= FAMILY_MEMORY_CHAR_BUDGET,
      `pinned ${pinnedChars} exceeds budget ${FAMILY_MEMORY_CHAR_BUDGET}`,
    );
  });

  it("is stable: the same store pins the same set across turns", () => {
    const rows = fill(60, 150);
    const first = selectPinnedMemories(rows);
    // Same rows, different arrival order (a re-query orders differently).
    const second = selectPinnedMemories([...rows].reverse());

    assert.deepEqual(
      first.pinned.map((row) => row.id),
      second.pinned.map((row) => row.id),
      "pinned set flickered when only input order changed",
    );
  });

  it("renders pinned memories oldest first so a child's story reads in order", () => {
    const rows = fill(40, 150);
    const { pinned } = selectPinnedMemories(rows);
    const times = pinned.map((row) => Date.parse(row.created_at));

    assert.deepEqual(times, [...times].sort((a, b) => a - b));
  });

  it("handles an empty store", () => {
    const { pinned, overflow, pinnedChars } = selectPinnedMemories([]);
    assert.deepEqual(pinned, []);
    assert.deepEqual(overflow, []);
    assert.equal(pinnedChars, 0);
  });

  it("packs greedily: one oversized row does not strand the rest", () => {
    const rows = [
      memory({ content: "z".repeat(300), created_at: "2026-07-20 12:00:00+00" }),
      ...fill(20, 200),
    ];
    const { pinned } = selectPinnedMemories(rows, { budget: 500 });

    assert.ok(pinned.length >= 2, "greedy fill should seat shorter rows behind a big one");
    assert.ok(memoryUsageChars(pinned) <= 500);
  });
});

describe("compaction trigger", () => {
  it("fires below the budget, so merging happens before anything overflows", () => {
    const threshold = FAMILY_MEMORY_CHAR_BUDGET * MEMORY_COMPACTION_TRIGGER_RATIO;
    assert.equal(threshold, 3200);
    assert.ok(threshold < FAMILY_MEMORY_CHAR_BUDGET);
  });

  it("leaves headroom measured against the real fleet leader", () => {
    const threshold = FAMILY_MEMORY_CHAR_BUDGET * MEMORY_COMPACTION_TRIGGER_RATIO;
    // The heaviest real family on 2026-07-20: 21 active rows, 3,114 chars,
    // 9 of them saved from phone calls. They sit just under the trigger and
    // cross it on their next save, which is the intended shape: compaction
    // wakes with roughly 800 characters of runway still in hand.
    const gomesChars = 3114;
    assert.ok(gomesChars < threshold, "fleet leader should not be over the line yet");
    assert.ok(threshold - gomesChars < 150, "and should be about one memory away");
  });
});
