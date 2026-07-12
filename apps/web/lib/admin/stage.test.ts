import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveFamilyStage } from "./stage";

const NOW = new Date("2026-07-12T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function stage(overrides: Partial<Parameters<typeof deriveFamilyStage>[0]>) {
  return deriveFamilyStage({
    createdAt: daysAgo(30),
    profileCompletedAt: daysAgo(29),
    childCount: 1,
    hasReport: true,
    lastUserActivityAt: daysAgo(1),
    now: NOW,
    ...overrides,
  });
}

test("no family setup means new, whatever the age", () => {
  assert.equal(stage({ profileCompletedAt: null }), "new");
  assert.equal(stage({ profileCompletedAt: null, createdAt: daysAgo(60) }), "new");
});

test("setup without kids is still new", () => {
  assert.equal(stage({ childCount: 0 }), "new");
});

test("setup and kids but no report is onboarding", () => {
  assert.equal(stage({ hasReport: false, createdAt: daysAgo(3), profileCompletedAt: daysAgo(2), lastUserActivityAt: daysAgo(1) }), "onboarding");
});

test("report within 21 days of signup is activated", () => {
  assert.equal(stage({ createdAt: daysAgo(10), profileCompletedAt: daysAgo(9) }), "activated");
});

test("report past 21 days is steady", () => {
  assert.equal(stage({ createdAt: daysAgo(40) }), "steady");
});

test("14 quiet days moves an older family to quiet, report or not", () => {
  assert.equal(stage({ lastUserActivityAt: daysAgo(15) }), "quiet");
  assert.equal(stage({ hasReport: false, lastUserActivityAt: daysAgo(20) }), "quiet");
});

test("a brand-new family is never quiet, even with zero activity", () => {
  assert.equal(
    stage({ createdAt: daysAgo(2), profileCompletedAt: daysAgo(2), hasReport: false, lastUserActivityAt: null }),
    "onboarding",
  );
});

test("no activity ever counts from signup", () => {
  assert.equal(stage({ lastUserActivityAt: null, createdAt: daysAgo(20) }), "quiet");
});
