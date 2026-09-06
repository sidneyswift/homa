import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import type * as Hours from "./hours";
import type * as HoursView from "../features/hours/hours-view";

// Execute the real reader/view modules without importing the native bridge or
// constructing a Supabase client. Only the read transport is synthetic.
function loadSource<T>(relativePath: string, dependencies: Record<string, unknown>): T {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  runInNewContext(outputText, {
    module,
    exports: module.exports,
    require(name: string) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected runtime import: ${name}`);
      return dependencies[name];
    },
  });
  return module.exports as T;
}

function fixture(sources: unknown[]) {
  const rows = sources.map((source, index) => ({
    id: `entry-${index}`, child_id: "child-1", subject: "reading", minutes: 10,
    happened_on: "2026-09-06", source, note: null,
  }));
  const query = {
    select() { return query; },
    eq() { return query; },
    gte() { return query; },
    lte() { return query; },
    order() { return query; },
    limit() { return Promise.resolve({ data: rows, error: null }); },
  };
  const hours = loadSource<typeof Hours>("./hours.ts", {
    "./supabase": { supabase: { from(table: string) { assert.equal(table, "hours_log"); return query; } } },
    "./mutation-receipt": { requireMutationReceipt() { throw new Error("No mutations in a read test."); } },
  });
  const view = loadSource<typeof HoursView>("../features/hours/hours-view.ts", { "../../lib/hours": hours });
  return { hours, view };
}

const expected = [
  ["chat", "Chat"], ["sms", "Text"], ["call", "Phone call"],
  ["email", "Email"], ["dispatch", "Scheduled check-in"],
] as const;

describe("native Hours source provenance", () => {
  it("preserves all five stored sources through the Hours read and visible labels", async () => {
    const { hours, view } = fixture(expected.map(([source]) => source));
    assert.deepEqual(Array.from(hours.HOURS_SOURCES), expected.map(([source]) => source));
    const rows = await hours.getHoursLogForFamily("family-1");
    const entries = view.toHoursEntries(rows, []);
    assert.equal(entries.length, expected.length);
    entries.forEach((entry, index) => {
      assert.equal(entry.source, expected[index][0]);
      assert.equal(view.SOURCE_LABELS[entry.source], expected[index][1]);
    });
  });

  it("preserves the same five sources through the Planner window read", async () => {
    const { hours, view } = fixture(expected.map(([source]) => source));
    const rows = await hours.getHoursLogForFamilyBetween("family-1", "2026-09-01", "2026-09-06");
    rows.forEach((row, index) => {
      assert.equal(row.source, expected[index][0]);
      assert.equal(view.SOURCE_LABELS[row.source], expected[index][1]);
    });
    assert.equal(rows.length, expected.length);
  });

  it("rejects an unknown or malformed source without returning a relabeled partial record", async () => {
    for (const source of ["invented", "EMAIL", " email", "", null, undefined, 1, {}]) {
      const { hours } = fixture(["chat", source, "dispatch"]);
      await assert.rejects(hours.getHoursLogForFamily("family-1"), /Unknown Hours record source\./);
      await assert.rejects(
        hours.getHoursLogForFamilyBetween("family-1", "2026-09-01", "2026-09-06"),
        /Unknown Hours record source\./,
      );
    }
  });

  it("keeps an empty record readable", async () => {
    const { hours } = fixture([]);
    assert.equal((await hours.getHoursLogForFamily("family-1")).length, 0);
    assert.equal((await hours.getHoursLogForFamilyBetween("family-1", "2026-09-01", "2026-09-06")).length, 0);
  });
});
