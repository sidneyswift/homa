import assert from "node:assert/strict";
import test from "node:test";

import {
  createNativeCaptureLoopSession,
  type NativeCaptureLoopEventInput,
} from "./capture-loop-session";

const LOOP_ID = "00000000-0000-4000-8000-000000000001";
const MATERIAL_ID = "00000000-0000-4000-8000-000000000002";

function ids(): () => string | null {
  const values = [
    LOOP_ID,
    "00000000-0000-4000-8000-000000000003",
    "00000000-0000-4000-8000-000000000004",
    "00000000-0000-4000-8000-000000000005",
    "00000000-0000-4000-8000-000000000006",
    "00000000-0000-4000-8000-000000000007",
    "00000000-0000-4000-8000-000000000008",
  ];
  return () => values.shift() ?? null;
}

function input() {
  return {
    familyId: "family-local-only",
    profile: "device_handoff" as const,
    intent: "share_material" as const,
    surface: "material_detail" as const,
    objectKind: "material" as const,
    objectId: MATERIAL_ID,
    revisionId: MATERIAL_ID,
  };
}

test("records one ordered handoff lifecycle with one proposal revision", async () => {
  const events: NativeCaptureLoopEventInput[] = [];
  const session = createNativeCaptureLoopSession(
    input(),
    (_familyId, event) => {
      events.push(event);
    },
    ids(),
  );
  assert.ok(session);

  session.record("entry_intent");
  session.record("review_presented");
  session.record("approval_recorded");
  session.record("effect_attempted");
  session.record("outcome_uncertain", { exitReason: "unknown" });
  await session.flush();

  assert.deepEqual(events.map((event) => event.stage), [
    "entry_intent",
    "review_presented",
    "approval_recorded",
    "effect_attempted",
    "outcome_uncertain",
  ]);
  assert.deepEqual(events.map((event) => event.sequence), [1, 2, 3, 4, 5]);
  assert.deepEqual(
    events.slice(1, 4).map((event) => [event.revision, event.revision_id]),
    [[1, MATERIAL_ID], [1, MATERIAL_ID], [1, MATERIAL_ID]],
  );
  assert.equal(session.hasAttemptedEffect, true);
  assert.equal(events.at(-1)?.exit_reason, "unknown");
});

test("abandonment closes an unattempted flow once and never after an attempt", () => {
  const events: NativeCaptureLoopEventInput[] = [];
  const session = createNativeCaptureLoopSession(
    input(),
    (_familyId, event) => {
      events.push(event);
    },
    ids(),
  );
  assert.ok(session);

  session.record("entry_intent");
  session.record("review_presented");
  session.abandon();
  session.abandon();
  assert.deepEqual(events.map((event) => event.stage), [
    "entry_intent",
    "review_presented",
    "safe_abandonment",
  ]);
  assert.equal(events.at(-1)?.exit_reason, "parent_cancelled");

  const attempted = createNativeCaptureLoopSession(
    input(),
    (_familyId, event) => {
      events.push(event);
    },
    ids(),
  );
  assert.ok(attempted);
  attempted.record("entry_intent");
  attempted.record("effect_attempted");
  attempted.abandon();
  assert.equal(events.filter((event) => event.stage === "safe_abandonment").length, 1);
});

test("rejects a branch shape that would not survive the canonical schema", () => {
  const session = createNativeCaptureLoopSession(
    { ...input(), branchScope: "family", branchId: MATERIAL_ID },
    () => undefined,
    ids(),
  );
  assert.equal(session, null);
});

test("does not add proposal revision fields to a direct mutation", async () => {
  const events: NativeCaptureLoopEventInput[] = [];
  const session = createNativeCaptureLoopSession(
    {
      familyId: "family-local-only",
      profile: "direct_mutation",
      intent: "schedule_learning",
      surface: "planner",
      objectKind: "plan_activity",
      objectId: null,
    },
    (_familyId, event) => {
      events.push(event);
    },
    ids(),
  );
  assert.ok(session);
  session.record("entry_intent");
  session.record("effect_attempted");
  await Promise.resolve();
  assert.deepEqual(events.map((event) => [event.stage, event.revision, event.revision_id]), [
    ["entry_intent", null, null],
    ["effect_attempted", null, null],
  ]);
});
