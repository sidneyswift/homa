import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPTURE_LOOP_EVENT_NAME,
  CAPTURE_LOOP_EVENT_NAMES,
  CAPTURE_LOOP_PROFILE_MANIFESTS,
  CAPTURE_LOOP_PROFILES,
  CAPTURE_LOOP_STAGES,
  buildCaptureLoopNativeClientContext,
  captureLoopClientContextSchema,
  captureLoopEventPropsSchema,
  nativeCaptureLoopEventPropsSchema,
  captureLoopTraceIssues,
  captureLoopTraceQualifiesForNorthStar,
  captureLoopTraceQualifiesForStabilizedNorthStar,
  type CaptureLoopEventProps,
  type CaptureLoopProfile,
  type CaptureLoopStage,
} from "./capture-loop";
import {
  EVENT_SCHEMAS,
  mobileFamilyEventRequestSchema,
} from "./events";

const LOOP_ID = "00000000-0000-4000-8000-000000000001";
const MATERIAL_ID = "00000000-0000-4000-8000-000000000003";
const PRIOR_EVENT_ID = "00000000-0000-4000-8000-000000000004";
const SECOND_BRANCH_ID = "00000000-0000-4000-8000-000000000005";
const SECOND_OBJECT_ID = "00000000-0000-4000-8000-000000000006";
const CORRECTION_LOOP_ID = "00000000-0000-4000-8000-000000000007";

const REVISION_STAGES = new Set<CaptureLoopStage>([
  "proposal_ready",
  "review_presented",
  "approval_recorded",
  "effect_attempted",
  "outcome_verified",
]);

const REVISIONED_PROFILES = new Set<CaptureLoopProfile>([
  "proposed_effect",
  "device_mutation",
  "device_handoff",
  "capture_confirmation",
  "passive_delivery",
  "background_observation",
]);

function eventId(sequence: number): string {
  return `10000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function stageEvent(
  stage: CaptureLoopStage,
  sequence: number,
  overrides: Partial<CaptureLoopEventProps> = {},
): CaptureLoopEventProps {
  const profile = overrides.profile ?? "proposed_effect";
  const isOutcome = stage === "outcome_verified";
  const needsRevision =
    REVISIONED_PROFILES.has(profile) && REVISION_STAGES.has(stage);
  return {
    contract_version: 1,
    event_id: eventId(sequence),
    loop_id: LOOP_ID,
    parent_loop_id: null,
    branch_id: null,
    branch_scope: "family",
    profile,
    intent: "create_material",
    stage,
    sequence,
    surface: "chat",
    object_kind: "material",
    object_id: MATERIAL_ID,
    client_context: {
      client: "web",
      app_version: "5148f800",
      build_number: null,
      runtime_version: null,
      update_id: null,
    },
    outcome_kind: isOutcome ? "artifact_ready" : null,
    result_state: isOutcome ? "complete" : "not_applicable",
    receipt_kind: isOutcome ? "artifact_receipt" : "none",
    revision: needsRevision ? 1 : null,
    corrects_event_id: null,
    correction_result:
      stage === "correction_or_undo_verified" ? "corrected" : null,
    exit_reason: null,
    ...overrides,
  };
}

function successfulTrace(
  profile: CaptureLoopProfile,
  overrides: Partial<CaptureLoopEventProps> = {},
): CaptureLoopEventProps[] {
  const {
    outcome_kind,
    receipt_kind,
    result_state,
    ...commonOverrides
  } = overrides;
  const successPath = CAPTURE_LOOP_PROFILE_MANIFESTS[profile].success_path;
  if (successPath === null) {
    throw new Error(`${profile} has no verified outcome path`);
  }
  return successPath.map(
    (stage, index) =>
      stageEvent(stage, index + 1, {
        profile,
        ...commonOverrides,
        ...(stage === "outcome_verified" && outcome_kind !== undefined
          ? { outcome_kind }
          : {}),
        ...(stage === "outcome_verified" && receipt_kind !== undefined
          ? { receipt_kind }
          : {}),
        ...(stage === "outcome_verified" && result_state !== undefined
          ? { result_state }
          : {}),
      }),
  );
}

test("capture loop registry has one canonical name and complete profile manifests", () => {
  assert.equal(CAPTURE_LOOP_EVENT_NAME, "product.loop_stage_recorded");
  assert.equal(new Set(CAPTURE_LOOP_EVENT_NAMES).size, CAPTURE_LOOP_EVENT_NAMES.length);
  assert.equal(new Set(CAPTURE_LOOP_STAGES).size, CAPTURE_LOOP_STAGES.length);
  assert.deepEqual(
    Object.keys(CAPTURE_LOOP_PROFILE_MANIFESTS).sort(),
    [...CAPTURE_LOOP_PROFILES].sort(),
  );
  assert.equal(
    EVENT_SCHEMAS[CAPTURE_LOOP_EVENT_NAME],
    captureLoopEventPropsSchema,
    "the event registry must reuse the canonical schema object",
  );

  for (const profile of CAPTURE_LOOP_PROFILES) {
    const manifest = CAPTURE_LOOP_PROFILE_MANIFESTS[profile];
    assert.equal(
      new Set(manifest.ordered_path).size,
      manifest.ordered_path.length,
      `${profile} repeats an ordered stage`,
    );
    assert.equal(
      new Set(manifest.allowed_stages).size,
      manifest.allowed_stages.length,
      `${profile} repeats an allowed stage`,
    );
    if (manifest.success_path === null) {
      assert.ok(
        ["device_mutation", "device_handoff", "background_observation"].includes(
          profile,
        ),
      );
      assert.equal(manifest.ordered_path.at(-1), "effect_attempted");
    } else {
      assert.equal(manifest.success_path.at(-1), "outcome_verified", profile);
    }
    for (const stage of manifest.ordered_path) {
      assert.ok(manifest.allowed_stages.includes(stage), `${profile}: ${stage}`);
    }
  }

  const direct = CAPTURE_LOOP_PROFILE_MANIFESTS.direct_mutation.success_path;
  assert.ok(direct);
  assert.equal(direct.includes("proposal_ready"), false);
  assert.equal(direct.includes("review_presented"), false);
  assert.equal(direct.includes("approval_recorded"), false);
});

test("canonical props are strict and reject family content or identity", () => {
  const base = stageEvent("entry_intent", 1);
  const forbidden = [
    "family_id",
    "user_id",
    "member_user_id",
    "child_id",
    "child_name",
    "message",
    "text",
    "content",
    "transcript",
    "prompt",
    "email",
    "phone",
    "recipient",
    "destination",
    "calendar_name",
    "filename",
    "title",
    "url",
    "error",
    "qualifies_for_north_star",
  ] as const;

  assert.equal(captureLoopEventPropsSchema.safeParse(base).success, true);
  for (const property of forbidden) {
    assert.equal(
      captureLoopEventPropsSchema.safeParse({
        ...base,
        [property]: "private family content",
      }).success,
      false,
      property,
    );
  }
  assert.equal(
    captureLoopEventPropsSchema.safeParse({
      ...base,
      client_context: {
        ...base.client_context,
        device_id: "persistent-device-id",
      },
    }).success,
    false,
  );
});

test("native client context requires release code identity, never a device fingerprint", () => {
  const ios = {
    client: "ios",
    app_version: "1.0.0",
    build_number: "42",
    runtime_version: "f33dd2307f31e8694a7b2727641a13a4f5f06f86",
    update_id: "019fc368-64b6-7efe-8f33-912d8c430d6f",
  } as const;
  assert.equal(captureLoopClientContextSchema.safeParse(ios).success, true);
  assert.equal(
    captureLoopClientContextSchema.safeParse({ ...ios, runtime_version: null })
      .success,
    false,
  );
  assert.equal(
    captureLoopClientContextSchema.safeParse({ ...ios, runtime_version: "device-123" })
      .success,
    false,
  );
  assert.equal(
    captureLoopClientContextSchema.safeParse({
      client: "web",
      app_version: "5148f800",
      build_number: null,
      runtime_version: ios.runtime_version,
      update_id: null,
    }).success,
    false,
  );

  assert.deepEqual(
    buildCaptureLoopNativeClientContext({
      platform: "ios",
      appVersion: "1.0.0",
      buildNumber: "42",
      runtimeVersion: ios.runtime_version,
      updateId: ios.update_id,
    }),
    ios,
  );
  assert.deepEqual(
    buildCaptureLoopNativeClientContext({
      platform: "android",
      appVersion: "1.0.0",
      buildNumber: 42,
      runtimeVersion: ios.runtime_version,
      updateId: null,
    }),
    {
      client: "android",
      app_version: "1.0.0",
      build_number: "42",
      runtime_version: ios.runtime_version,
      update_id: null,
    },
  );
  assert.equal(
    buildCaptureLoopNativeClientContext({
      platform: "web",
      appVersion: "1.0.0",
      buildNumber: "42",
      runtimeVersion: ios.runtime_version,
      updateId: null,
    }),
    null,
  );
});

test("verified outcomes require exact product receipts and safe exits require evidence", () => {
  const artifact = stageEvent("outcome_verified", 7);
  assert.equal(captureLoopEventPropsSchema.safeParse(artifact).success, true);
  assert.equal(
    captureLoopEventPropsSchema.safeParse({
      ...artifact,
      receipt_kind: "system_handoff_receipt",
    }).success,
    false,
  );
  assert.equal(
    captureLoopEventPropsSchema.safeParse({
      ...artifact,
      outcome_kind: "model_response",
    }).success,
    false,
  );
  assert.equal(
    captureLoopEventPropsSchema.safeParse({
      ...artifact,
      outcome_kind: "invitation_accepted",
    }).success,
    false,
  );

  const abandoned = stageEvent("safe_abandonment", 2, {
    outcome_kind: null,
    receipt_kind: "none",
    exit_reason: "parent_cancelled",
  });
  assert.equal(captureLoopEventPropsSchema.safeParse(abandoned).success, true);
  assert.equal(
    captureLoopEventPropsSchema.safeParse({
      ...abandoned,
      exit_reason: "timeout",
    }).success,
    false,
  );
  for (const exit_reason of ["duplicate", "superseded"] as const) {
    assert.equal(
      captureLoopEventPropsSchema.safeParse({ ...abandoned, exit_reason })
        .success,
      false,
    );
  }
});

test("mobile and web parse the same canonical properties without a client family id", () => {
  const native = stageEvent("entry_intent", 1, {
    client_context: {
      client: "ios",
      app_version: "1.0.0",
      build_number: "42",
      runtime_version: "f33dd2307f31e8694a7b2727641a13a4f5f06f86",
      update_id: "019fc368-64b6-7efe-8f33-912d8c430d6f",
    },
  });
  assert.equal(
    mobileFamilyEventRequestSchema.safeParse({
      name: CAPTURE_LOOP_EVENT_NAME,
      props: native,
    }).success,
    true,
  );
  assert.equal(nativeCaptureLoopEventPropsSchema.safeParse(native).success, true);
  assert.equal(
    nativeCaptureLoopEventPropsSchema.safeParse(stageEvent("entry_intent", 1))
      .success,
    false,
  );
  assert.equal(
    nativeCaptureLoopEventPropsSchema.safeParse({
      ...stageEvent("outcome_verified", 7),
      client_context: native.client_context,
    }).success,
    false,
    "native cannot label a server artifact receipt as its own verified outcome",
  );
  assert.equal(
    mobileFamilyEventRequestSchema.safeParse({
      name: CAPTURE_LOOP_EVENT_NAME,
      props: { ...native, family_id: LOOP_ID },
    }).success,
    false,
  );
  assert.equal(
    mobileFamilyEventRequestSchema.safeParse({
      name: CAPTURE_LOOP_EVENT_NAME,
      props: stageEvent("entry_intent", 1),
    }).success,
    false,
    "the mobile relay must reject a web client context",
  );
});

test("trace guard accepts profile compression and out-of-order delivery", () => {
  const proposed = successfulTrace("proposed_effect");
  const direct = successfulTrace("direct_mutation", {
    intent: "complete_learning",
    object_kind: "progress_operation",
    outcome_kind: "durable_change",
    receipt_kind: "database_receipt",
  });

  assert.deepEqual(captureLoopTraceIssues([...proposed].reverse()), []);
  assert.deepEqual(captureLoopTraceIssues(direct), []);
  assert.equal(captureLoopTraceQualifiesForNorthStar(proposed), true);
  assert.equal(captureLoopTraceQualifiesForNorthStar(direct), true);
});

test("trace guard rejects missing approval, duplicate events, and false abandonment", () => {
  const proposed = successfulTrace("proposed_effect");
  const withoutApproval = proposed.filter(
    (event) => event.stage !== "approval_recorded",
  );
  assert.ok(
    captureLoopTraceIssues(withoutApproval).includes(
      "proposed_effect outcome is missing required stages",
    ),
  );

  const duplicate = proposed.map((event, index) =>
    index === 1 ? { ...event, event_id: proposed[0].event_id } : event,
  );
  assert.ok(captureLoopTraceIssues(duplicate).includes("event_id is duplicated"));

  const falseAbandonment = [
    stageEvent("entry_intent", 1),
    stageEvent("effect_attempted", 2),
    stageEvent("safe_abandonment", 3, {
      outcome_kind: null,
      receipt_kind: "none",
      exit_reason: "parent_cancelled",
    }),
  ];
  assert.ok(
    captureLoopTraceIssues(falseAbandonment).includes(
      "safe abandonment cannot follow an unresolved effect attempt",
    ),
  );
});

test("trace guard binds approval to the latest presented revision", () => {
  const trace = [
    stageEvent("entry_intent", 1),
    stageEvent("capture_accepted", 2),
    stageEvent("proposal_ready", 3, { revision: 1 }),
    stageEvent("review_presented", 4, { revision: 1 }),
    stageEvent("proposal_ready", 5, { revision: 2 }),
    stageEvent("review_presented", 6, { revision: 2 }),
    stageEvent("approval_recorded", 7, { revision: 1 }),
    stageEvent("effect_attempted", 8, { revision: 2 }),
    stageEvent("outcome_verified", 9, { revision: 2 }),
  ];

  assert.ok(
    captureLoopTraceIssues(trace).includes(
      "outcome does not match the latest reviewed revision",
    ),
  );
  assert.equal(captureLoopTraceQualifiesForNorthStar(trace), false);
});

test("trace guard rejects branch, object, and sequence splicing", () => {
  const trace = successfulTrace("direct_mutation", {
    intent: "complete_learning",
    object_kind: "progress_operation",
    outcome_kind: "durable_change",
    receipt_kind: "database_receipt",
    branch_scope: "single_child",
    branch_id: PRIOR_EVENT_ID,
  });
  const mixed = trace.map((event, index) =>
    index === trace.length - 1
      ? {
          ...event,
          branch_id: SECOND_BRANCH_ID,
          object_id: SECOND_OBJECT_ID,
          sequence: 4,
        }
      : event,
  );
  const issues = captureLoopTraceIssues(mixed);
  assert.ok(issues.includes("trace mixes branch ids"));
  assert.ok(issues.includes("trace changes object id"));
  assert.ok(issues.includes("sequence must be contiguous and start at one"));
  assert.equal(captureLoopTraceQualifiesForNorthStar(mixed), false);
});

test("effect failures and resumptions require evidence for their exact state", () => {
  const common = {
    profile: "direct_mutation" as const,
    intent: "complete_learning" as const,
    object_kind: "plan_activity" as const,
  };
  const falseFailure = [
    stageEvent("entry_intent", 1, common),
    stageEvent("effect_attempted", 2, common),
    stageEvent("failed_before_effect", 3, {
      ...common,
      exit_reason: "timeout",
    }),
  ];
  assert.ok(
    captureLoopTraceIssues(falseFailure).includes(
      "failed_before_effect cannot follow an effect attempt",
    ),
  );

  const rolledBack = [
    stageEvent("entry_intent", 1, common),
    stageEvent("effect_attempted", 2, common),
    stageEvent("rollback_verified", 3, {
      ...common,
      receipt_kind: "database_receipt",
      exit_reason: "timeout",
    }),
  ];
  assert.deepEqual(captureLoopTraceIssues(rolledBack), []);

  const orphanResume = [
    stageEvent("entry_intent", 1, common),
    stageEvent("resumed", 2, common),
    stageEvent("interrupted", 3, {
      ...common,
      exit_reason: "app_backgrounded",
    }),
    stageEvent("resumed", 4, common),
  ];
  assert.ok(
    captureLoopTraceIssues(orphanResume).includes(
      "resumed has no preceding interruption",
    ),
  );
});

test("incomplete, handoff, passive, and advice traces never become north-star wins", () => {
  const incomplete = [stageEvent("entry_intent", 1)];
  assert.deepEqual(captureLoopTraceIssues(incomplete), []);
  assert.equal(captureLoopTraceQualifiesForNorthStar(incomplete), false);

  const handoffCommon = {
    profile: "device_handoff" as const,
    intent: "share_material" as const,
  };
  const handoff = [
    stageEvent("entry_intent", 1, handoffCommon),
    stageEvent("review_presented", 2, handoffCommon),
    stageEvent("approval_recorded", 3, handoffCommon),
    stageEvent("effect_attempted", 4, handoffCommon),
    stageEvent("outcome_uncertain", 5, {
      ...handoffCommon,
      exit_reason: "unknown",
    }),
  ];
  assert.deepEqual(captureLoopTraceIssues(handoff), []);
  assert.equal(captureLoopTraceQualifiesForNorthStar(handoff), false);

  const passive = successfulTrace("passive_delivery", {
    intent: "share_material",
    object_kind: "material",
    outcome_kind: "provider_delivery_confirmed",
    receipt_kind: "provider_delivery_receipt",
  });
  assert.deepEqual(captureLoopTraceIssues(passive), []);
  assert.equal(captureLoopTraceQualifiesForNorthStar(passive), false);

  const partial = successfulTrace("direct_mutation", {
    intent: "schedule_learning",
    object_kind: "plan_activity",
    outcome_kind: "durable_change",
    result_state: "partial",
    receipt_kind: "database_receipt",
  });
  assert.deepEqual(captureLoopTraceIssues(partial), []);
  assert.equal(captureLoopTraceQualifiesForNorthStar(partial), false);

  const advice = successfulTrace("direct_mutation", {
    intent: "ask_homa",
    outcome_kind: "durable_change",
    receipt_kind: "database_receipt",
  });
  assert.ok(captureLoopTraceIssues(advice).length > 0);
  assert.equal(captureLoopTraceQualifiesForNorthStar(advice), false);

  const taskOpen = successfulTrace("direct_mutation", {
    intent: "open_task_result",
    object_kind: "task_run",
    outcome_kind: "durable_change",
    receipt_kind: "database_receipt",
  });
  assert.ok(captureLoopTraceIssues(taskOpen).length > 0);
  assert.equal(captureLoopTraceQualifiesForNorthStar(taskOpen), false);
});

test("verified corrections stabilize or reverse the original family win", () => {
  const original = successfulTrace("proposed_effect");
  const originalOutcome = original.at(-1);
  assert.ok(originalOutcome);
  const correction = [
    stageEvent("entry_intent", 1, {
      loop_id: CORRECTION_LOOP_ID,
      profile: "direct_mutation",
      intent: "correct_or_undo",
      parent_loop_id: LOOP_ID,
    }),
    stageEvent("effect_attempted", 2, {
      loop_id: CORRECTION_LOOP_ID,
      profile: "direct_mutation",
      intent: "correct_or_undo",
      parent_loop_id: LOOP_ID,
    }),
    stageEvent("correction_or_undo_verified", 3, {
      loop_id: CORRECTION_LOOP_ID,
      profile: "direct_mutation",
      intent: "correct_or_undo",
      parent_loop_id: LOOP_ID,
      corrects_event_id: originalOutcome.event_id,
      correction_result: "corrected",
      receipt_kind: "artifact_receipt",
    }),
  ];
  assert.deepEqual(captureLoopTraceIssues(correction), []);
  assert.equal(captureLoopTraceQualifiesForNorthStar(correction), false);
  assert.equal(
    captureLoopTraceQualifiesForStabilizedNorthStar(original, [correction]),
    true,
  );
  const reversed = correction.map((event) =>
    event.stage === "correction_or_undo_verified"
      ? { ...event, correction_result: "reversed" as const }
      : event,
  );
  assert.equal(
    captureLoopTraceQualifiesForStabilizedNorthStar(original, [reversed]),
    false,
  );
});

test("an uncertain effect may reconcile to a later verified outcome in the same loop", () => {
  const trace = successfulTrace("direct_mutation", {
    intent: "complete_learning",
    object_kind: "progress_operation",
    outcome_kind: "durable_change",
    receipt_kind: "database_receipt",
  });
  const uncertain = stageEvent("outcome_uncertain", 3, {
    profile: "direct_mutation",
    intent: "complete_learning",
    object_kind: "progress_operation",
    exit_reason: "app_backgrounded",
  });
  const reconciled = [
    trace[0],
    trace[1],
    uncertain,
    { ...trace[2], event_id: eventId(4), sequence: 4 },
  ];

  assert.deepEqual(captureLoopTraceIssues(reconciled), []);
  assert.equal(captureLoopTraceQualifiesForNorthStar(reconciled), true);
  assert.ok(
    captureLoopTraceIssues([trace[0], uncertain]).includes(
      "outcome uncertainty needs a preceding effect attempt",
    ),
  );
});
