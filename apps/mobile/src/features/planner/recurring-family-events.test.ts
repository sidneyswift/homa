import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FamilyEventRecord } from "../../lib/family-events";
import { expandRecurringFamilyEvents } from "./recurring-family-events";

function event(overrides: Partial<FamilyEventRecord> = {}): FamilyEventRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    family_id: "22222222-2222-4222-8222-222222222222",
    child_id: null,
    title: "Co-op",
    starts_on: "2026-08-04",
    ends_on: "2026-08-04",
    start_time: "09:00",
    end_time: "12:00",
    note: null,
    recurrence_rule: { frequency: "weekly", interval: 1, weekdays: [2], until: null },
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("recurring family events", () => {
  it("expands a weekly series only inside the visible Planner window", () => {
    const rows = expandRecurringFamilyEvents([event()], "2026-08-01", "2026-08-31");
    assert.deepEqual(rows.map((row) => row.starts_on), [
      "2026-08-04",
      "2026-08-11",
      "2026-08-18",
      "2026-08-25",
    ]);
    assert.ok(rows.every((row) => row.id === event().id));
  });

  it("honors interval, weekday, and until without fabricating later dates", () => {
    const rows = expandRecurringFamilyEvents([
      event({
        recurrence_rule: { frequency: "weekly", interval: 2, weekdays: [2, 4], until: "2026-08-20" },
      }),
    ], "2026-08-01", "2026-08-31");
    assert.deepEqual(rows.map((row) => row.starts_on), ["2026-08-04", "2026-08-06", "2026-08-18", "2026-08-20"]);
  });
});
