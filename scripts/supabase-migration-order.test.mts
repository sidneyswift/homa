import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFamilyHistorySql } from "./family-history-sql.mts";
import {
  APPLY_BEFORE,
  orderedMigrations,
  orderMigrationFiles,
} from "./supabase-migration-order.mts";

describe("migration replay order", () => {
  it("moves a dependency ahead of the migration that needs it", () => {
    const [dependency, dependent] = APPLY_BEFORE[0];
    const ordered = orderMigrationFiles([
      "20260707190000_child_reports.sql",
      "20260701000000_first.sql",
      "20260707120000_one_world_families.sql",
      "README.md",
    ]);
    assert.deepEqual(ordered, [
      "20260701000000_first.sql",
      dependency,
      dependent,
    ]);
  });

  it("orders the real migrations with every override satisfied", async () => {
    const ordered = await orderedMigrations();
    for (const [dependency, dependent] of APPLY_BEFORE) {
      assert.ok(ordered.indexOf(dependency) < ordered.indexOf(dependent));
    }
  });
});

describe("family history for an existing family", () => {
  const base = {
    profile: "month1" as const,
    state: "PA",
    familyName: "Rivera",
    seed: 1,
    asOf: new Date("2026-11-02T00:00:00Z"),
    familyId: "00000000-0000-4000-8000-000000000001",
  };

  it("references the family's real children, never invented ids", () => {
    const childIds = [
      "00000000-0000-4000-8000-0000000000a1",
      "00000000-0000-4000-8000-0000000000a2",
    ];
    const { sql } = buildFamilyHistorySql({ ...base, children: 2, childIds });
    assert.doesNotMatch(sql, /insert into public\.children/u);
    assert.doesNotMatch(sql, /insert into public\.families/u);
    const referenced = new Set(
      [...sql.matchAll(/'(00000000-0000-4000-8000-0000000000a[0-9])'/gu)].map((match) => match[1]),
    );
    assert.ok(referenced.size > 0);
    for (const id of referenced) assert.ok(childIds.includes(id), id);
  });

  it("refuses an existing family without its child ids", () => {
    assert.throws(
      () => buildFamilyHistorySql({ ...base, children: 2 }),
      /real child ids/u,
    );
  });
});
