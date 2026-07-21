import assert from "node:assert/strict";
import { test } from "node:test";

import { chooseDripNudge, type DripSignals } from "./sweep";

const NOW = new Date("2026-07-20T12:00:00Z");
const DAYS = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const HOURS = (n: number) => new Date(NOW.getTime() - n * 60 * 60 * 1000);

function base(overrides: Partial<DripSignals> = {}): DripSignals {
  return {
    familyId: "fam-1",
    email: "parent@example.com",
    firstName: "Sam",
    createdAt: DAYS(3),
    profileCompletedAt: null,
    hasKid: false,
    hasReport: false,
    reportEmailedAt: null,
    anyReportViewed: false,
    unviewedChildName: null,
    unviewedReportToken: null,
    optedOut: false,
    suppressed: false,
    lastDripSentAt: null,
    sentKinds: [],
    ...overrides,
  };
}

test("setup nudge fires for a signed-up family with no report, past 24h", () => {
  assert.deepEqual(chooseDripNudge(base(), NOW), { kind: "drip_setup_nudge" });
});

test("setup nudge fires when setup is done but no kid was added", () => {
  const signals = base({ profileCompletedAt: DAYS(2), hasKid: false });
  assert.deepEqual(chooseDripNudge(signals, NOW), { kind: "drip_setup_nudge" });
});

test("setup nudge waits until the family is at least a day old", () => {
  assert.equal(chooseDripNudge(base({ createdAt: HOURS(3) }), NOW), null);
});

test("setup nudge never repeats once sent", () => {
  assert.equal(chooseDripNudge(base({ sentKinds: ["drip_setup_nudge"] }), NOW), null);
});

test("report-unviewed nudge fires when a report was emailed and never opened, past 48h", () => {
  const signals = base({
    hasKid: true,
    hasReport: true,
    profileCompletedAt: DAYS(3),
    reportEmailedAt: DAYS(3),
    anyReportViewed: false,
    unviewedChildName: "Sam",
    unviewedReportToken: "tok-123",
  });
  assert.deepEqual(chooseDripNudge(signals, NOW), {
    kind: "drip_report_unviewed",
    childName: "Sam",
    reportToken: "tok-123",
  });
});

test("report-unviewed nudge does not fire once any report was opened", () => {
  const signals = base({
    hasKid: true,
    hasReport: true,
    reportEmailedAt: DAYS(3),
    anyReportViewed: true,
    unviewedChildName: "Sam",
    unviewedReportToken: "tok-123",
  });
  assert.equal(chooseDripNudge(signals, NOW), null);
});

test("report-unviewed nudge waits 48h after the report email", () => {
  const signals = base({
    hasKid: true,
    hasReport: true,
    reportEmailedAt: HOURS(6),
    unviewedChildName: "Sam",
    unviewedReportToken: "tok-123",
  });
  assert.equal(chooseDripNudge(signals, NOW), null);
});

test("the 7-day global cap silences everything", () => {
  const signals = base({ lastDripSentAt: DAYS(2) });
  assert.equal(chooseDripNudge(signals, NOW), null);
});

test("the global cap lifts after 7 days", () => {
  const signals = base({ lastDripSentAt: DAYS(8) });
  assert.deepEqual(chooseDripNudge(signals, NOW), { kind: "drip_setup_nudge" });
});

test("opt-out silences everything", () => {
  const signals = base({
    optedOut: true,
    hasReport: true,
    reportEmailedAt: DAYS(3),
    unviewedChildName: "Sam",
    unviewedReportToken: "tok-123",
  });
  assert.equal(chooseDripNudge(signals, NOW), null);
});

test("a suppressed address gets nothing, even when otherwise eligible", () => {
  assert.equal(chooseDripNudge(base({ suppressed: true }), NOW), null);
});

test("a family with an opened report and full setup gets nothing", () => {
  const signals = base({
    profileCompletedAt: DAYS(3),
    hasKid: true,
    hasReport: true,
    anyReportViewed: true,
  });
  assert.equal(chooseDripNudge(signals, NOW), null);
});
