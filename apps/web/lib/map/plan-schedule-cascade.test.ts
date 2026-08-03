import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FourWeekPlan } from "@homa/core";

import {
  editPlanActivities,
  getPlanRebuildReceipt,
  writeRebuiltPlan,
} from "./store";

/**
 * The transactional shape of the two schedule-cascade writes (issue
 * #256). editPlanActivities' child_plans UPDATE plus its whole
 * plan_activity_schedule cascade, and writeRebuiltPlan's upsert plus
 * schedule clear, must each commit as ONE transaction: a crash between
 * the statements would strand rows whose indices point at the wrong
 * activity, and the calendar would present that wrong date as real.
 *
 * Same fake-postgres convention as remove-child-blobs.test.ts: a tagged
 * template that records every statement, here with an `inTx` flag so
 * the tests can assert which statements ran inside sql.begin.
 */

const FAMILY = "11111111-1111-1111-1111-111111111111";
const CHILD = "22222222-2222-2222-2222-222222222222";
const ASSET = "33333333-3333-4333-8333-333333333333";

function plan(overrides: Partial<FourWeekPlan> = {}): FourWeekPlan {
  return {
    subjectId: "math",
    subjectName: "Math",
    childAgeLabel: "6 years",
    startingLine: null,
    targets: ["counts to 20"],
    weeks: [
      {
        week: 1,
        focus: "counting",
        activities: ["Count to 20 daily", "Play a counting game", "Count the stairs"],
      },
      { week: 2, focus: "counting", activities: ["Count objects around the house"] },
    ],
    styleNote: null,
    bankVersion: "test",
    ...overrides,
  };
}

interface Recorded {
  text: string;
  args: unknown[];
  inTx: boolean;
}

interface FakeDb {
  sql: unknown;
  statements: Recorded[];
}

/** Just enough postgres.js: a tagged template recording text + args +
 * whether it ran inside `.begin`, plus the `.json` passthrough the
 * store's jsonb writes call. `respond` supplies each query's rows. */
function fakeDb(respond: (text: string, args: unknown[]) => unknown[] | Error): FakeDb {
  const statements: Recorded[] = [];
  const makeTag = (inTx: boolean) => {
    const tag = (
      strings: TemplateStringsArray | readonly string[],
      ...args: unknown[]
    ): Promise<unknown[]> | readonly string[] => {
      if (!("raw" in strings)) return strings;
      const text = strings.join(" ? ").replace(/\s+/gu, " ").trim();
      statements.push({ text, args, inTx });
      const rows = respond(text, args);
      if (rows instanceof Error) return Promise.reject(rows);
      return Promise.resolve(rows);
    };
    (tag as unknown as { json: unknown }).json = (value: unknown) => value;
    (tag as unknown as { begin: unknown }).begin = (
      run: (tx: unknown) => Promise<unknown>,
    ) => run(makeTag(true));
    return tag;
  };
  return { sql: makeTag(false), statements };
}

function respondForEdit(options: {
  scheduled: { activity_index: number; scheduled_date: string }[];
  failInsert?: boolean;
  canonicalSources?: {
    id: string;
    title: string;
    sourceLocator?: string | null;
  }[];
  existingSources?: Array<{
    asset_id: string;
    week: number;
    activity_index: number;
    activity_text: string;
    source_title: string;
    source_locator: string | null;
  }>;
}) {
  return (text: string): unknown[] | Error => {
    if (/select id from public\.children/u.test(text)) return [{ id: CHILD }];
    if (/select id, plan, progress from public\.child_plans/u.test(text)) {
      return [{ id: "plan-1", plan: plan(), progress: { "1.0": true } }];
    }
    if (
      /select id, title, unit_source_locator as "sourceLocator"/u.test(text)
    ) {
      return options.canonicalSources ?? [];
    }
    if (
      /select asset_id, week, activity_index, activity_text/u.test(text)
    ) {
      return options.existingSources ?? [];
    }
    if (/select activity_index, scheduled_date/u.test(text)) return options.scheduled;
    if (options.failInsert && /insert into public\.plan_activity_schedule/u.test(text)) {
      return new Error("connection reset mid-cascade");
    }
    return [];
  };
}

describe("editPlanActivities schedule cascade (issue #256)", () => {
  it("runs the plan UPDATE and the entire cascade inside one transaction", async () => {
    const db = fakeDb(
      respondForEdit({
        scheduled: [
          { activity_index: 0, scheduled_date: "2026-08-03" },
          { activity_index: 1, scheduled_date: "2026-08-04" },
        ],
      }),
    );
    const outcome = await editPlanActivities(
      FAMILY,
      CHILD,
      "math",
      [{ action: "remove", week: 1, index: 0 }],
      db.sql as Parameters<typeof editPlanActivities>[4],
    );
    assert.equal(outcome.status, "applied");

    const writes = db.statements.filter(
      (statement) =>
        /update public\.child_plans/u.test(statement.text) ||
        /public\.plan_activity_schedule/u.test(statement.text),
    );
    assert.ok(writes.length >= 4, "expected the update, select, delete, and reinsert");
    for (const statement of writes) {
      assert.ok(
        statement.inTx,
        `must run inside the transaction, ran outside: ${statement.text}`,
      );
    }
  });

  it("remaps surviving rows and drops the removed activity's date", async () => {
    const db = fakeDb(
      respondForEdit({
        scheduled: [
          { activity_index: 0, scheduled_date: "2026-08-03" },
          { activity_index: 1, scheduled_date: "2026-08-04" },
        ],
      }),
    );
    await editPlanActivities(
      FAMILY,
      CHILD,
      "math",
      [{ action: "remove", week: 1, index: 0 }],
      db.sql as Parameters<typeof editPlanActivities>[4],
    );

    const deletes = db.statements.filter((statement) =>
      /delete from public\.plan_activity_schedule/u.test(statement.text),
    );
    assert.equal(deletes.length, 1);
    assert.deepEqual(deletes[0].args, [FAMILY, CHILD, "math", 1]);

    const inserts = db.statements.filter((statement) =>
      /insert into public\.plan_activity_schedule/u.test(statement.text),
    );
    // Index 0's date goes with its removed activity; index 1 slides to 0.
    assert.equal(inserts.length, 1);
    assert.deepEqual(inserts[0].args, [FAMILY, CHILD, "math", 1, 0, "2026-08-04"]);

    const deleteAt = db.statements.findIndex((statement) =>
      /delete from public\.plan_activity_schedule/u.test(statement.text),
    );
    const insertAt = db.statements.findIndex((statement) =>
      /insert into public\.plan_activity_schedule/u.test(statement.text),
    );
    assert.ok(deleteAt < insertAt, "delete-then-reinsert, never in-place shifts");
  });

  it("touches no schedule rows for an add-only edit", async () => {
    const db = fakeDb(respondForEdit({ scheduled: [] }));
    const outcome = await editPlanActivities(
      FAMILY,
      CHILD,
      "math",
      [{ action: "add", week: 2, text: "Count backwards from 10" }],
      db.sql as Parameters<typeof editPlanActivities>[4],
    );
    assert.equal(outcome.status, "applied");
    const scheduleStatements = db.statements.filter((statement) =>
      /plan_activity_schedule/u.test(statement.text),
    );
    assert.deepEqual(scheduleStatements, []);
  });

  it("writes canonical source edges in the same transaction as the plan", async () => {
    const db = fakeDb(
      respondForEdit({
        scheduled: [],
        canonicalSources: [{ id: ASSET, title: "Counting workbook" }],
      }),
    );
    const outcome = await editPlanActivities(
      FAMILY,
      CHILD,
      "math",
      [
        {
          action: "add",
          week: 2,
          text: "Count the workbook pictures",
          sourceFamilyAssetIds: [ASSET],
        },
      ],
      db.sql as Parameters<typeof editPlanActivities>[4],
    );
    assert.equal(outcome.status, "applied");
    if (outcome.status !== "applied") return;
    assert.equal(outcome.sourceLinks[0]?.sourceTitle, "Counting workbook");

    const sourceWrites = db.statements.filter((statement) =>
      /(?:delete from|insert into) public\.family_asset_plan_links/u.test(
        statement.text,
      ),
    );
    assert.equal(sourceWrites.length, 2);
    assert.ok(sourceWrites.every((statement) => statement.inTx));
    assert.deepEqual(sourceWrites[0].args, [FAMILY, CHILD, "math", 2]);
    assert.deepEqual(sourceWrites[1].args, [
      FAMILY,
      ASSET,
      CHILD,
      "math",
      2,
      1,
      "Count the workbook pictures",
      "Counting workbook",
      null,
    ]);
  });

  it("rejects a source outside the family before any write", async () => {
    const db = fakeDb(
      respondForEdit({ scheduled: [], canonicalSources: [] }),
    );
    const outcome = await editPlanActivities(
      FAMILY,
      CHILD,
      "math",
      [
        {
          action: "replace",
          week: 1,
          index: 0,
          text: "Use the foreign workbook",
          sourceFamilyAssetIds: [ASSET],
        },
      ],
      db.sql as Parameters<typeof editPlanActivities>[4],
    );
    assert.equal(outcome.status, "invalid_edit");
    assert.equal(
      db.statements.some(
        (statement) =>
          /update public\.child_plans|insert into public\.family_asset_plan_links/u.test(
            statement.text,
          ),
      ),
      false,
    );
  });

  it("propagates a mid-cascade failure instead of reporting applied", async () => {
    const db = fakeDb(
      respondForEdit({
        scheduled: [
          { activity_index: 0, scheduled_date: "2026-08-03" },
          { activity_index: 1, scheduled_date: "2026-08-04" },
        ],
        failInsert: true,
      }),
    );
    await assert.rejects(
      editPlanActivities(
        FAMILY,
        CHILD,
        "math",
        [{ action: "remove", week: 1, index: 0 }],
        db.sql as Parameters<typeof editPlanActivities>[4],
      ),
      /mid-cascade/u,
    );
    // Nothing after the failed transaction runs: the family touch would
    // otherwise stamp updated_at for a write that rolled back.
    const familyTouch = db.statements.find((statement) =>
      /update public\.families/u.test(statement.text),
    );
    assert.equal(familyTouch, undefined);
  });

  it("writes nothing for a child outside the family", async () => {
    const db = fakeDb((text) =>
      /select id from public\.children/u.test(text) ? [] : [],
    );
    const outcome = await editPlanActivities(
      FAMILY,
      CHILD,
      "math",
      [{ action: "remove", week: 1, index: 0 }],
      db.sql as Parameters<typeof editPlanActivities>[4],
    );
    assert.equal(outcome.status, "unknown_child");
    assert.equal(
      db.statements.some((statement) => /update|insert|delete/u.test(statement.text)),
      false,
      "the tenancy wall must stop every write",
    );
  });
});

describe("writeRebuiltPlan (issue #256)", () => {
  function respondForRebuild(options: {
    existing?: boolean;
    cleared?: number;
    clearedLinks?: number;
    failUpsert?: boolean;
  } = {}) {
    const existing = options.existing ?? true;
    const nextProgress = existing ? { "2.1": true } : {};
    return (text: string): unknown[] | Error => {
      if (/select id from public\.children/u.test(text)) return [{ id: CHILD }];
      if (/select id, plan, progress, plan_revision/u.test(text)) {
        return existing
          ? [
              {
                id: "plan-1",
                plan: plan(),
                progress: { "1.0": true, "1.1": true },
                plan_revision: 4,
                progress_revision: 8,
              },
            ]
          : [];
      }
      if (/select asset_id, week, activity_index, activity_text/u.test(text)) {
        return [
          {
            asset_id: ASSET,
            week: 1,
            activity_index: 0,
            activity_text: "Count to 20 daily",
            source_title: "Counting workbook",
            source_locator: "Page 2",
          },
        ];
      }
      if (/select week, activity_index,/u.test(text)) {
        return [{ week: 1, activity_index: 0, scheduled_date: "2026-08-03" }];
      }
      if (/insert into public\.child_plan_rebuild_history/u.test(text)) {
        return [{ id: "history-1" }];
      }
      if (/insert into public\.child_plans/u.test(text)) {
        if (options.failUpsert) return new Error("replacement failed");
        return [{ retest_at: "2026-08-31 00:00:00", progress: nextProgress }];
      }
      if (/delete from public\.plan_activity_schedule/u.test(text)) {
        return Array.from({ length: options.cleared ?? 0 }, (_, index) => ({
          id: `row-${index}`,
        }));
      }
      if (/delete from public\.family_asset_plan_links/u.test(text)) {
        return Array.from({ length: options.clearedLinks ?? 0 }, (_, index) => ({
          id: `link-${index}`,
        }));
      }
      return [];
    };
  }

  function rebuiltPlan(): FourWeekPlan {
    return plan({
      weeks: [
        { week: 1, focus: "new work", activities: ["Try a new puzzle"] },
        {
          week: 2,
          focus: "counting",
          activities: ["Sort the blocks", "Count to 20 daily"],
        },
      ],
    });
  }

  it("archives the old meaning, remaps exact completion, and clears positional rows atomically", async () => {
    const db = fakeDb(respondForRebuild({ cleared: 2, clearedLinks: 1 }));
    const written = await writeRebuiltPlan(db.sql as Parameters<typeof writeRebuiltPlan>[0], {
      familyId: FAMILY,
      childId: CHILD,
      subjectId: "math",
      plan: rebuiltPlan(),
    });
    assert.equal(written.retestAt, "2026-08-31 00:00:00");
    assert.deepEqual(written.progress, { "2.1": true });
    assert.equal(written.clearedScheduledDays, 2);
    assert.equal(written.clearedSourceLinks, 1);
    assert.equal(written.archivedDoneCount, 2);
    assert.equal(written.preservedDoneCount, 1);
    assert.equal(written.archivedUnmatchedDoneCount, 1);
    assert.equal(written.rebuildHistoryId, "history-1");

    for (const statement of db.statements) {
      assert.ok(statement.inTx, `must run inside the transaction: ${statement.text}`);
    }
    const archiveAt = db.statements.findIndex((statement) =>
      /insert into public\.child_plan_rebuild_history/u.test(statement.text),
    );
    const replaceAt = db.statements.findIndex((statement) =>
      /insert into public\.child_plans/u.test(statement.text),
    );
    assert.ok(archiveAt >= 0 && archiveAt < replaceAt, "history lands before replacement");
    const archive = db.statements[archiveAt];
    assert.deepEqual(archive.args.slice(0, 5), [CHILD, "math", "plan-1", 4, 8]);
    assert.deepEqual(archive.args[6], { "1.0": true, "1.1": true });
    assert.deepEqual(archive.args[7], { "2.1": true });

    const clear = db.statements.find((statement) =>
      /delete from public\.plan_activity_schedule/u.test(statement.text),
    );
    assert.ok(clear, "the rebuild must clear the plan's schedule rows");
    // Scoped to exactly this family + child + subject, never wider.
    assert.deepEqual(clear.args, [FAMILY, CHILD, "math"]);
  });

  it("writes a first plan without inventing history", async () => {
    const db = fakeDb(respondForRebuild({ existing: false }));
    const written = await writeRebuiltPlan(db.sql as Parameters<typeof writeRebuiltPlan>[0], {
      familyId: FAMILY,
      childId: CHILD,
      subjectId: "math",
      plan: plan(),
    });
    assert.equal(written.wasNew, true);
    assert.deepEqual(written.progress, {});
    assert.equal(written.clearedScheduledDays, 0);
    assert.equal(written.rebuildHistoryId, null);
    assert.equal(
      db.statements.some((statement) =>
        /insert into public\.child_plan_rebuild_history/u.test(statement.text),
      ),
      false,
    );
  });

  it("rejects a child outside the family before any plan write", async () => {
    const db = fakeDb((text) =>
      /select id from public\.children/u.test(text) ? [] : [],
    );
    await assert.rejects(
      writeRebuiltPlan(db.sql as Parameters<typeof writeRebuiltPlan>[0], {
        familyId: FAMILY,
        childId: CHILD,
        subjectId: "math",
        plan: plan(),
      }),
      /does not belong/u,
    );
    assert.equal(
      db.statements.some((statement) =>
        /insert into public\.child_plans|child_plan_rebuild_history/u.test(
          statement.text,
        ),
      ),
      false,
    );
  });

  it("never reports success when replacement fails after the archive statement", async () => {
    const db = fakeDb(respondForRebuild({ failUpsert: true }));
    await assert.rejects(
      writeRebuiltPlan(db.sql as Parameters<typeof writeRebuiltPlan>[0], {
        familyId: FAMILY,
        childId: CHILD,
        subjectId: "math",
        plan: rebuiltPlan(),
      }),
      /replacement failed/u,
    );
    assert.ok(
      db.statements
        .filter((statement) =>
          /child_plan_rebuild_history|insert into public\.child_plans/u.test(
            statement.text,
          ),
        )
        .every((statement) => statement.inTx),
    );
  });
});

describe("getPlanRebuildReceipt", () => {
  it("derives claims only from history scoped to the token, subject, and current plan", async () => {
    const db = fakeDb((text) =>
      /from public\.child_plan_rebuild_history/u.test(text)
        ? [
            {
              preserved_done_count: "2",
              archived_unmatched_done_count: "1",
              cleared_scheduled_days: "3",
            },
          ]
        : [],
    );
    const receipt = await getPlanRebuildReceipt(
      "report-token",
      "math",
      "history-1",
      db.sql as Parameters<typeof getPlanRebuildReceipt>[3],
    );
    assert.deepEqual(receipt, {
      preservedDoneCount: 2,
      archivedUnmatchedDoneCount: 1,
      clearedScheduledDays: 3,
    });
    assert.equal(db.statements.length, 1);
    assert.deepEqual(db.statements[0].args, ["report-token", "math", "history-1"]);
    assert.match(db.statements[0].text, /join public\.child_reports/u);
    assert.match(db.statements[0].text, /join public\.child_plans/u);
  });

  it("returns no claims for a receipt outside the joined boundary", async () => {
    const db = fakeDb(() => []);
    const receipt = await getPlanRebuildReceipt(
      "report-token",
      "math",
      "foreign-history",
      db.sql as Parameters<typeof getPlanRebuildReceipt>[3],
    );
    assert.equal(receipt, null);
  });
});
