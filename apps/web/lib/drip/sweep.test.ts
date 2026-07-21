import assert from "node:assert/strict";
import { test } from "node:test";

import { chooseDripNudge, planDripSends, type DripSignals } from "./sweep";

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
    planChildName: null,
    planSubjectId: null,
    planCreatedAt: null,
    closedLoop: false,
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

function withPlan(overrides: Partial<DripSignals> = {}): DripSignals {
  return base({
    profileCompletedAt: DAYS(20),
    hasKid: true,
    hasReport: true,
    anyReportViewed: true,
    planChildName: "Mia",
    planSubjectId: "reading",
    planCreatedAt: DAYS(9),
    ...overrides,
  });
}

test("loop-back nudge fires for a plan with no word back, a week on", () => {
  assert.deepEqual(chooseDripNudge(withPlan(), NOW), {
    kind: "drip_loop_back",
    childName: "Mia",
    subjectId: "reading",
  });
});

test("loop-back nudge does not fire once the parent closed the loop", () => {
  assert.equal(chooseDripNudge(withPlan({ closedLoop: true }), NOW), null);
});

test("loop-back nudge waits a full week after the plan", () => {
  assert.equal(chooseDripNudge(withPlan({ planCreatedAt: DAYS(2) }), NOW), null);
});

test("loop-back nudge never repeats once sent", () => {
  assert.equal(
    chooseDripNudge(withPlan({ sentKinds: ["drip_loop_back"] }), NOW),
    null,
  );
});

test("loop-back nudge needs a real plan to name, never fires without one", () => {
  assert.equal(chooseDripNudge(withPlan({ planSubjectId: null }), NOW), null);
});

test("an unopened report outranks the loop-back nudge", () => {
  const signals = withPlan({
    anyReportViewed: false,
    reportEmailedAt: DAYS(3),
    unviewedChildName: "Mia",
    unviewedReportToken: "tok-9",
  });
  assert.deepEqual(chooseDripNudge(signals, NOW), {
    kind: "drip_report_unviewed",
    childName: "Mia",
    reportToken: "tok-9",
  });
});

test("suppression and the 7-day cap silence the loop-back nudge too", () => {
  assert.equal(chooseDripNudge(withPlan({ suppressed: true }), NOW), null);
  assert.equal(chooseDripNudge(withPlan({ lastDripSentAt: DAYS(2) }), NOW), null);
});

test("the per-run cap trickles a backlog and reports the real queue size", () => {
  const backlog = Array.from({ length: 12 }, (_, i) =>
    base({ familyId: `fam-${i}` }),
  );
  const plan = planDripSends(backlog, NOW, 5);
  assert.equal(plan.sends.length, 5);
  assert.equal(plan.eligible, 12);
  assert.equal(plan.capped, true);
});

test("a queue under the cap sends everything and reports no cap", () => {
  const plan = planDripSends([base({ familyId: "a" }), base({ familyId: "b" })], NOW, 5);
  assert.equal(plan.sends.length, 2);
  assert.equal(plan.eligible, 2);
  assert.equal(plan.capped, false);
});

test("the cap counts only eligible families, never the ineligible", () => {
  const signals = [
    base({ familyId: "eligible" }),
    base({ familyId: "suppressed", suppressed: true }),
    base({ familyId: "too-new", createdAt: HOURS(1) }),
  ];
  const plan = planDripSends(signals, NOW, 5);
  assert.equal(plan.eligible, 1);
  assert.equal(plan.sends[0].family.familyId, "eligible");
  assert.equal(plan.capped, false);
});
