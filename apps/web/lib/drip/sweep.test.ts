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
    midChecklistChildName: null,
    midChecklistAnswerCount: 0,
    midChecklistLastAnsweredAt: null,
    kid2PendingChildName: null,
    latestReportChildName: null,
    latestReportCreatedAt: null,
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

// The per-tick cap decides who waits, so its order is a real product rule,
// not an implementation detail. Before this, the cap took whatever rows
// Postgres returned and the highest-intent families could sit behind the
// lowest (seen live 2026-07-21).

/** A family whose report was emailed and never opened. */
function withUnopenedReport(overrides: Partial<DripSignals> = {}): DripSignals {
  return base({
    profileCompletedAt: DAYS(20),
    hasKid: true,
    hasReport: true,
    anyReportViewed: false,
    reportEmailedAt: DAYS(4),
    unviewedChildName: "Mia",
    unviewedReportToken: "tok",
    ...overrides,
  });
}

test("the cap serves the unopened report before the loop-back and the setup stall", () => {
  const signals = [
    base({ familyId: "setup" }),
    withPlan({ familyId: "loop" }),
    withUnopenedReport({ familyId: "report" }),
  ];
  const plan = planDripSends(signals, NOW, 2);
  assert.deepEqual(
    plan.sends.map((send) => send.family.familyId),
    ["report", "loop"],
  );
  assert.equal(plan.eligible, 3);
  assert.equal(plan.capped, true);
});

test("inside one nudge, the family who has waited longest goes first", () => {
  const signals = [
    withUnopenedReport({ familyId: "newer", reportEmailedAt: DAYS(3) }),
    withUnopenedReport({ familyId: "oldest", reportEmailedAt: DAYS(9) }),
    withUnopenedReport({ familyId: "middle", reportEmailedAt: DAYS(6) }),
  ];
  assert.deepEqual(
    planDripSends(signals, NOW, 3).sends.map((send) => send.family.familyId),
    ["oldest", "middle", "newer"],
  );
});

test("the plan is total and reproducible: same input, same order", () => {
  const signals = [
    withUnopenedReport({ familyId: "b-family", reportEmailedAt: DAYS(5) }),
    withUnopenedReport({ familyId: "a-family", reportEmailedAt: DAYS(5) }),
  ];
  const first = planDripSends(signals, NOW, 5).sends.map((s) => s.family.familyId);
  const again = planDripSends([...signals].reverse(), NOW, 5).sends.map((s) => s.family.familyId);
  assert.deepEqual(first, ["a-family", "b-family"]);
  assert.deepEqual(again, first);
});

test("ordering never changes who is eligible, only who goes first", () => {
  const signals = [base({ familyId: "s" }), withUnopenedReport({ familyId: "r" })];
  const plan = planDripSends(signals, NOW, 99);
  assert.equal(plan.eligible, 2);
  assert.equal(plan.capped, false);
  assert.equal(plan.sends.length, 2);
});

// Beat-keyed audiences (plans/2026-07-21-chat-first-onboarding.md §9
// Phase 2): mid-checklist, kid-2-pending, revealed-never-returned.

function withReportOnly(overrides: Partial<DripSignals> = {}): DripSignals {
  return base({
    profileCompletedAt: DAYS(20),
    hasKid: true,
    hasReport: true,
    anyReportViewed: true,
    latestReportChildName: "Mia",
    latestReportCreatedAt: DAYS(4),
    ...overrides,
  });
}

test("revealed-never-returned fires for a report with no plan, past 2 days", () => {
  assert.deepEqual(chooseDripNudge(withReportOnly(), NOW), {
    kind: "drip_revealed_never_returned",
    childName: "Mia",
  });
});

test("revealed-never-returned waits 2 days after the report", () => {
  assert.equal(
    chooseDripNudge(withReportOnly({ latestReportCreatedAt: HOURS(6) }), NOW),
    null,
  );
});

test("revealed-never-returned steps aside once a plan exists (loop-back's job)", () => {
  assert.deepEqual(
    chooseDripNudge(
      withReportOnly({ planChildName: "Mia", planSubjectId: "reading", planCreatedAt: DAYS(9) }),
      NOW,
    ),
    { kind: "drip_loop_back", childName: "Mia", subjectId: "reading" },
  );
});

test("revealed-never-returned does not fire once the parent closed the loop", () => {
  assert.equal(chooseDripNudge(withReportOnly({ closedLoop: true }), NOW), null);
});

test("revealed-never-returned never repeats once sent", () => {
  assert.equal(
    chooseDripNudge(
      withReportOnly({ sentKinds: ["drip_revealed_never_returned"] }),
      NOW,
    ),
    null,
  );
});

test("an unopened report outranks revealed-never-returned", () => {
  const signals = withReportOnly({
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

function withKid2Pending(overrides: Partial<DripSignals> = {}): DripSignals {
  return base({
    profileCompletedAt: DAYS(20),
    hasKid: true,
    hasReport: true,
    anyReportViewed: true,
    latestReportChildName: "Mia",
    latestReportCreatedAt: DAYS(4),
    kid2PendingChildName: "Leo",
    ...overrides,
  });
}

test("kid-2-pending fires for a sibling with zero answers once a report exists, past 2 days", () => {
  assert.deepEqual(chooseDripNudge(withKid2Pending(), NOW), {
    kind: "drip_kid2_pending",
    childName: "Leo",
  });
});

test("kid-2-pending outranks revealed-never-returned when both apply", () => {
  // A family with a report, no plan, AND an untouched sibling: the
  // sibling nudge is closer to a fresh ask than a generic "come back".
  const decision = chooseDripNudge(withKid2Pending(), NOW);
  assert.equal(decision?.kind, "drip_kid2_pending");
});

test("kid-2-pending never repeats once sent, falling through to the next-best audience", () => {
  // withKid2Pending's fixture also satisfies revealed-never-returned (a
  // report, no plan, no closed loop): once kid-2-pending is used up, that
  // is the correct next nudge, not silence.
  assert.deepEqual(
    chooseDripNudge(withKid2Pending({ sentKinds: ["drip_kid2_pending"] }), NOW),
    { kind: "drip_revealed_never_returned", childName: "Mia" },
  );
});

test("kid-2-pending never repeats once sent, and silence is correct once every fallback is also spent", () => {
  assert.equal(
    chooseDripNudge(
      withKid2Pending({
        sentKinds: ["drip_kid2_pending", "drip_revealed_never_returned"],
      }),
      NOW,
    ),
    null,
  );
});

test("kid-2-pending never fires without latestReportCreatedAt, even with a name set", () => {
  // In real data kid2PendingChildName is only ever computed alongside a
  // real sibling report, so this combination cannot occur in practice;
  // proven here as a defensive gate, not silence. A family this fresh
  // (no report, no profile) correctly falls through to the setup nudge.
  assert.deepEqual(
    chooseDripNudge(base({ kid2PendingChildName: "Leo" }), NOW),
    { kind: "drip_setup_nudge" },
  );
});

function withMidChecklist(overrides: Partial<DripSignals> = {}): DripSignals {
  return base({
    profileCompletedAt: DAYS(5),
    hasKid: true,
    hasReport: false,
    midChecklistChildName: "Mia",
    midChecklistAnswerCount: 9,
    midChecklistLastAnsweredAt: DAYS(3),
    ...overrides,
  });
}

test("mid-checklist fires for a partial questionnaire stalled past 2 days", () => {
  assert.deepEqual(chooseDripNudge(withMidChecklist(), NOW), {
    kind: "drip_mid_checklist",
    childName: "Mia",
    answerCount: 9,
  });
});

test("mid-checklist waits 2 days after the last answer", () => {
  assert.equal(
    chooseDripNudge(withMidChecklist({ midChecklistLastAnsweredAt: HOURS(6) }), NOW),
    null,
  );
});

test("mid-checklist never repeats once sent", () => {
  assert.equal(
    chooseDripNudge(withMidChecklist({ sentKinds: ["drip_mid_checklist"] }), NOW),
    null,
  );
});

test("mid-checklist ranks behind kid-2-pending and revealed-never-returned", () => {
  const signals = withMidChecklist({
    latestReportChildName: "Leo",
    latestReportCreatedAt: DAYS(4),
  });
  assert.deepEqual(chooseDripNudge(signals, NOW), {
    kind: "drip_revealed_never_returned",
    childName: "Leo",
  });
});

test("mid-checklist ranks ahead of the setup nudge, which never fires once a kid is mid-questionnaire", () => {
  // profileCompletedAt set and hasKid true means setupEligible is false
  // regardless; this proves the family gets SOME nudge, not silence.
  assert.notEqual(chooseDripNudge(withMidChecklist(), NOW), null);
});

test("suppression and the global cap silence every beat-keyed audience too", () => {
  assert.equal(chooseDripNudge(withReportOnly({ suppressed: true }), NOW), null);
  assert.equal(chooseDripNudge(withKid2Pending({ suppressed: true }), NOW), null);
  assert.equal(chooseDripNudge(withMidChecklist({ suppressed: true }), NOW), null);
  assert.equal(
    chooseDripNudge(withReportOnly({ lastDripSentAt: DAYS(2) }), NOW),
    null,
  );
});
