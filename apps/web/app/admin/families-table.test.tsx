import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { FamilySnapshot } from "../../lib/admin/roster-data";
import type { FamilyStage } from "../../lib/admin/stage";
import { FamiliesTable, type FamiliesTableState } from "./families-table";

function snapshot(
  n: number,
  overrides: Partial<FamilySnapshot> = {},
): FamilySnapshot {
  return {
    id: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
    name: `Family ${n}`,
    parentName: null,
    email: null,
    usState: null,
    createdAt: new Date(Date.UTC(2026, 6, 1 + (n % 20), 12)).toISOString(),
    profileCompletedAt: null,
    journalOptOutAt: null,
    trialStartedAt: null,
    billingExempt: false,
    subscriptionStatus: null,
    sandbox: false,
    status: "complete",
    kidCount: 1,
    kidNames: ["Kid"],
    hasReport: false,
    firstReportAt: null,
    lastUserActivityAt: null,
    userMessages7d: 0,
    activityByDay: [0, 0, 0, 0, 0, 0, 0],
    latestRuns: {},
    tokens28d: 0,
    cost28dUsd: 0,
    stage: "new" as FamilyStage,
    ...overrides,
  };
}

const defaultState: FamiliesTableState = {
  stage: null,
  sort: "joined",
  dir: "desc",
  allRows: false,
};

describe("FamiliesTable", () => {
  it("caps rows at 15 and offers the rest behind one link", () => {
    const snapshots = Array.from({ length: 17 }, (_, i) => snapshot(i + 1));
    const html = renderToStaticMarkup(
      <FamiliesTable
        snapshots={snapshots}
        state={defaultState}
        rangeDays={7}
        includeTests={false}
      />,
    );
    assert.match(html, /Show all 17 families/u);
    assert.equal((html.match(/\/admin\/families\//gu) ?? []).length, 15);
  });

  it("filters by stage and shows per-stage counts", () => {
    const snapshots = [
      snapshot(1, { stage: "quiet", lastUserActivityAt: "2026-07-01T12:00:00Z" }),
      snapshot(2, { stage: "activated" }),
      snapshot(3, { stage: "activated" }),
    ];
    const html = renderToStaticMarkup(
      <FamiliesTable
        snapshots={snapshots}
        state={{ ...defaultState, stage: "quiet" }}
        rangeDays={7}
        includeTests={false}
      />,
    );
    assert.match(html, /All 3/u);
    assert.match(html, /Activated 2/u);
    assert.match(html, /Quiet 14d\+ 1/u);
    assert.match(html, /Family 1/u);
    assert.doesNotMatch(html, /Family 2/u);
  });

  it("marks test families and never uses red for quiet ones", () => {
    const snapshots = [
      snapshot(1, { sandbox: true }),
      snapshot(2, { stage: "quiet", lastUserActivityAt: "2026-07-01T12:00:00Z" }),
    ];
    const html = renderToStaticMarkup(
      <FamiliesTable
        snapshots={snapshots}
        state={defaultState}
        rangeDays={7}
        includeTests={true}
      />,
    );
    assert.match(html, />test</u);
    assert.match(html, /--gold-ink/u);
    assert.doesNotMatch(html, /--rose-600/u);
  });
});
