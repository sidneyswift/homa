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
const PROGRESS_ID = "00000000-0000-4000-8000-000000000008";
const PROGRESS_UNDO_ID = "00000000-0000-4000-8000-000000000009";

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
  const isReceipt =
    isOutcome ||
    stage === "correction_or_undo_verified" ||
    stage === "rollback_verified";
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
    receipt_id: isReceipt ? MATERIAL_ID : null,
    revision: needsRevision ? 1 : null,
    revision_id: needsRevision ? MATERIAL_ID : null,
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
        [
          "device_mutation",
          "device_handoff",
          "capture_confirmation",
          "passive_delivery",
          "background_observation",
        ].includes(profile),
      );
      assert.ok(manifest.ordered_path.includes("effect_attempted"), profile);
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

  const approvedPlan = stageEvent("outcome_verified", 7, {
    profile: "proposed_effect",
    intent: "plan_learning",
    object_kind: "plan",
    outcome_kind: "durable_change",
    receipt_kind: "database_receipt",
  });
  assert.equal(captureLoopEventPropsSchema.safeParse(approvedPlan).success, true);
  assert.equal(
    captureLoopEventPropsSchema.safeParse({
      ...approvedPlan,
      profile: "direct_mutation",
      revision: null,
    }).success,
    false,
    "a month-plan approval receipt cannot certify a direct mutation path",
  );
  const approvedRecord = {
    ...approvedPlan,
    intent: "manage_record" as const,
    object_kind: "compliance_record" as const,
  };
  assert.equal(captureLoopEventPropsSchema.safeParse(approvedRecord).success, true);
  assert.equal(
    captureLoopEventPropsSchema.safeParse({
      ...approvedRecord,
      revision: 2,
    }).success,
    false,
    "a compliance packet row cannot claim an arbitrary trace revision",
  );
  assert.equal(
    captureLoopEventPropsSchema.safeParse({
      ...approvedRecord,
      profile: "direct_mutation",
      revision: null,
      revision_id: null,
    }).success,
    false,
    "an approved compliance packet cannot certify a direct mutation path",
  );

  for (const proposedWithoutRevisionReceipt of [
    {
      intent: "schedule_learning" as const,
      object_kind: "plan_activity" as const,
    },
    {
      intent: "complete_learning" as const,
      object_kind: "progress_operation" as const,
    },
    {
      intent: "record_observation" as const,
      object_kind: "progress_operation" as const,
    },
    {
      intent: "record_hours" as const,
      object_kind: "hours_record" as const,
    },
  ]) {
    assert.equal(
      captureLoopEventPropsSchema.safeParse({
        ...approvedPlan,
        ...proposedWithoutRevisionReceipt,
      }).success,
      false,
      "a proposed outcome must bind its deterministic receipt to the approved revision",
    );
  }

  const supportedRollback = stageEvent("rollback_verified", 3, {
    profile: "direct_mutation",
    intent: "schedule_learning",
    object_kind: "plan_activity",
    object_id: SECOND_OBJECT_ID,
    receipt_kind: "database_receipt",
    receipt_id: SECOND_OBJECT_ID,
    exit_reason: "timeout",
  });
  assert.equal(
    captureLoopEventPropsSchema.safeParse(supportedRollback).success,
    true,
  );
  assert.equal(
    captureLoopEventPropsSchema.safeParse({
      ...supportedRollback,
      object_kind: "plan",
    }).success,
    false,
  );
  assert.equal(
    captureLoopEventPropsSchema.safeParse({
      ...supportedRollback,
      intent: "create_material",
      object_kind: "hours_record",
    }).success,
    false,
    "rollback diagnostics cannot pair an unrelated intent with a valid receipt class",
  );
  const unsupportedFamilyEventCorrection = stageEvent(
    "correction_or_undo_verified",
    3,
    {
      event_id: eventId(32),
      loop_id: CORRECTION_LOOP_ID,
      parent_loop_id: LOOP_ID,
      profile: "direct_mutation",
      intent: "correct_or_undo",
      object_kind: "family_event",
      object_id: SECOND_OBJECT_ID,
      receipt_kind: "database_receipt",
      receipt_id: SECOND_OBJECT_ID,
      corrects_event_id: PRIOR_EVENT_ID,
      correction_result: "reversed",
    },
  );
  assert.equal(
    captureLoopEventPropsSchema.safeParse(unsupportedFamilyEventCorrection)
      .success,
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

test("trace guard binds every effect to an earlier approval of the exact revision", () => {
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
      "effect_attempted does not follow the exact proposal revision",
    ),
  );
  assert.equal(captureLoopTraceQualifiesForNorthStar(trace), false);

  const reorderedRevision = [
    stageEvent("entry_intent", 1),
    stageEvent("capture_accepted", 2),
    stageEvent("proposal_ready", 3, { revision: 1 }),
    stageEvent("review_presented", 4, { revision: 1 }),
    stageEvent("approval_recorded", 5, { revision: 1 }),
    stageEvent("effect_attempted", 6, { revision: 1 }),
    stageEvent("proposal_ready", 7, { revision: 2 }),
    stageEvent("review_presented", 8, { revision: 2 }),
    stageEvent("effect_attempted", 9, { revision: 2 }),
    stageEvent("approval_recorded", 10, { revision: 2 }),
    stageEvent("outcome_verified", 11, { revision: 2 }),
  ];
  assert.ok(captureLoopTraceIssues(reorderedRevision).length > 0);
  assert.equal(
    captureLoopTraceQualifiesForNorthStar(reorderedRevision),
    false,
  );

  const orderedRevision = reorderedRevision.map((event, index) => {
    if (index === 8) {
      return { ...event, stage: "approval_recorded" as const };
    }
    if (index === 9) {
      return { ...event, stage: "effect_attempted" as const };
    }
    return event;
  });
  assert.deepEqual(captureLoopTraceIssues(orderedRevision), []);
  assert.equal(captureLoopTraceQualifiesForNorthStar(orderedRevision), true);

  const staleRevision = [
    stageEvent("entry_intent", 1),
    stageEvent("capture_accepted", 2),
    stageEvent("proposal_ready", 3, { revision: 1 }),
    stageEvent("review_presented", 4, { revision: 1 }),
    stageEvent("approval_recorded", 5, { revision: 1 }),
    stageEvent("proposal_ready", 6, { revision: 2 }),
    stageEvent("effect_attempted", 7, { revision: 1 }),
    stageEvent("outcome_verified", 8, { revision: 1 }),
  ];
  assert.ok(
    captureLoopTraceIssues(staleRevision).includes(
      "proposal revision cannot move backward",
    ),
  );
  assert.equal(captureLoopTraceQualifiesForNorthStar(staleRevision), false);
});

test("material remakes keep a stable chain root and bind every stage to one revision row", () => {
  const common = {
    profile: "proposed_effect" as const,
    intent: "create_material" as const,
    object_kind: "material" as const,
    object_id: MATERIAL_ID,
  };
  const remade = [
    stageEvent("entry_intent", 1, common),
    stageEvent("capture_accepted", 2, common),
    stageEvent("proposal_ready", 3, {
      ...common,
      revision: 1,
      revision_id: MATERIAL_ID,
    }),
    stageEvent("proposal_ready", 4, {
      ...common,
      revision: 2,
      revision_id: SECOND_OBJECT_ID,
    }),
    stageEvent("review_presented", 5, {
      ...common,
      revision: 2,
      revision_id: SECOND_OBJECT_ID,
    }),
    stageEvent("approval_recorded", 6, {
      ...common,
      revision: 2,
      revision_id: SECOND_OBJECT_ID,
    }),
    stageEvent("effect_attempted", 7, {
      ...common,
      revision: 2,
      revision_id: SECOND_OBJECT_ID,
    }),
    stageEvent("outcome_verified", 8, {
      ...common,
      revision: 2,
      revision_id: SECOND_OBJECT_ID,
      receipt_id: SECOND_OBJECT_ID,
    }),
  ];
  assert.deepEqual(captureLoopTraceIssues(remade), []);
  assert.equal(captureLoopTraceQualifiesForNorthStar(remade), true);

  const splicedRevision = remade.map((event) =>
    event.stage === "review_presented"
      ? { ...event, revision_id: PRIOR_EVENT_ID }
      : event,
  );
  assert.ok(
    captureLoopTraceIssues(splicedRevision).includes(
      "one proposal revision cannot change revision id",
    ),
  );
  assert.equal(captureLoopTraceQualifiesForNorthStar(splicedRevision), false);
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
    intent: "schedule_learning" as const,
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

  const unapprovedRollback = [
    stageEvent("effect_attempted", 1),
    stageEvent("rollback_verified", 2, {
      receipt_kind: "artifact_receipt",
      exit_reason: "timeout",
    }),
  ];
  assert.ok(captureLoopTraceIssues(unapprovedRollback).length > 0);

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

  const skippedResume = successfulTrace("direct_mutation", {
    intent: "complete_learning",
    object_kind: "progress_operation",
    outcome_kind: "durable_change",
    receipt_kind: "database_receipt",
  });
  skippedResume.splice(
    1,
    0,
    stageEvent("interrupted", 2, {
      profile: "direct_mutation",
      intent: "complete_learning",
      object_kind: "progress_operation",
      exit_reason: "offline",
    }),
  );
  skippedResume[2] = {
    ...skippedResume[2],
    event_id: eventId(3),
    sequence: 3,
  };
  skippedResume[3] = {
    ...skippedResume[3],
    event_id: eventId(4),
    sequence: 4,
  };
  assert.ok(
    captureLoopTraceIssues(skippedResume).includes(
      "trace continues without resuming its interruption",
    ),
  );
  assert.equal(captureLoopTraceQualifiesForNorthStar(skippedResume), false);
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

  const passiveCommon = {
    profile: "passive_delivery" as const,
    intent: "share_material" as const,
  };
  const passive = [
    stageEvent("proposal_ready", 1, passiveCommon),
    stageEvent("effect_attempted", 2, passiveCommon),
    stageEvent("review_presented", 3, passiveCommon),
  ];
  assert.deepEqual(captureLoopTraceIssues(passive), []);
  assert.equal(captureLoopTraceQualifiesForNorthStar(passive), false);

  const directDraftClaim = successfulTrace("direct_mutation");
  assert.ok(captureLoopTraceIssues(directDraftClaim).length > 0);
  assert.equal(
    captureLoopTraceQualifiesForNorthStar(directDraftClaim),
    false,
  );

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
      event_id: eventId(30),
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
  const wrongReceipt = correction.map((event) =>
    event.stage === "correction_or_undo_verified"
      ? { ...event, receipt_kind: "database_receipt" as const }
      : event,
  );
  assert.ok(captureLoopTraceIssues(wrongReceipt).length > 0);
  assert.equal(
    captureLoopTraceQualifiesForStabilizedNorthStar(original, [wrongReceipt]),
    false,
  );

  const progressOriginal = successfulTrace("direct_mutation", {
    intent: "complete_learning",
    object_kind: "progress_operation",
    object_id: PROGRESS_ID,
    outcome_kind: "durable_change",
    receipt_kind: "database_receipt",
  }).map((event) => ({
    ...event,
    receipt_id: event.stage === "outcome_verified" ? PROGRESS_ID : null,
  }));
  const progressOutcome = progressOriginal.at(-1);
  assert.ok(progressOutcome);
  const progressReversal = [
    stageEvent("entry_intent", 1, {
      loop_id: CORRECTION_LOOP_ID,
      parent_loop_id: progressOutcome.loop_id,
      profile: "direct_mutation",
      intent: "correct_or_undo",
      object_kind: "progress_operation",
      object_id: PROGRESS_ID,
    }),
    stageEvent("effect_attempted", 2, {
      loop_id: CORRECTION_LOOP_ID,
      parent_loop_id: progressOutcome.loop_id,
      profile: "direct_mutation",
      intent: "correct_or_undo",
      object_kind: "progress_operation",
      object_id: PROGRESS_ID,
    }),
    stageEvent("correction_or_undo_verified", 3, {
      event_id: eventId(31),
      loop_id: CORRECTION_LOOP_ID,
      parent_loop_id: progressOutcome.loop_id,
      profile: "direct_mutation",
      intent: "correct_or_undo",
      object_kind: "progress_operation",
      object_id: PROGRESS_ID,
      receipt_kind: "database_receipt",
      receipt_id: PROGRESS_UNDO_ID,
      corrects_event_id: progressOutcome.event_id,
      correction_result: "reversed",
    }),
  ];
  assert.deepEqual(captureLoopTraceIssues(progressReversal), []);
  assert.equal(
    captureLoopTraceQualifiesForStabilizedNorthStar(
      progressOriginal,
      [progressReversal],
    ),
    false,
  );
  const unsupportedProgressCorrection = progressReversal.map((event) =>
    event.stage === "correction_or_undo_verified"
      ? { ...event, correction_result: "corrected" as const }
      : event,
  );
  assert.ok(captureLoopTraceIssues(unsupportedProgressCorrection).length > 0);

  const abandoned = [
    stageEvent("entry_intent", 1, {
      loop_id: CORRECTION_LOOP_ID,
      profile: "direct_mutation",
      intent: "correct_or_undo",
      parent_loop_id: LOOP_ID,
    }),
    stageEvent("safe_abandonment", 2, {
      loop_id: CORRECTION_LOOP_ID,
      profile: "direct_mutation",
      intent: "correct_or_undo",
      parent_loop_id: LOOP_ID,
      exit_reason: "parent_cancelled",
    }),
  ];
  assert.deepEqual(captureLoopTraceIssues(abandoned), []);
  assert.equal(
    captureLoopTraceQualifiesForStabilizedNorthStar(original, [abandoned]),
    true,
  );

  const uncertain = [
    abandoned[0],
    stageEvent("effect_attempted", 2, {
      loop_id: CORRECTION_LOOP_ID,
      profile: "direct_mutation",
      intent: "correct_or_undo",
      parent_loop_id: LOOP_ID,
    }),
    stageEvent("outcome_uncertain", 3, {
      loop_id: CORRECTION_LOOP_ID,
      profile: "direct_mutation",
      intent: "correct_or_undo",
      parent_loop_id: LOOP_ID,
      exit_reason: "unknown",
    }),
  ];
  assert.deepEqual(captureLoopTraceIssues(uncertain), []);
  assert.equal(
    captureLoopTraceQualifiesForStabilizedNorthStar(original, [uncertain]),
    false,
  );

  const rolledBack = [
    uncertain[0],
    uncertain[1],
    stageEvent("rollback_verified", 3, {
      loop_id: CORRECTION_LOOP_ID,
      profile: "direct_mutation",
      intent: "correct_or_undo",
      parent_loop_id: LOOP_ID,
      receipt_kind: "artifact_receipt",
      exit_reason: "timeout",
    }),
  ];
  assert.ok(captureLoopTraceIssues(rolledBack).length > 0);
  assert.equal(
    captureLoopTraceQualifiesForStabilizedNorthStar(original, [rolledBack]),
    false,
  );

  const attemptedOnly = uncertain.slice(0, 2);
  assert.deepEqual(captureLoopTraceIssues(attemptedOnly), []);
  assert.equal(
    captureLoopTraceQualifiesForStabilizedNorthStar(original, [attemptedOnly]),
    false,
  );
});

test("capture confirmation stays diagnostic for each child branch", () => {
  const capture = (
    loop_id: string,
    branch_id: string,
    object_id: string,
  ) =>
    CAPTURE_LOOP_PROFILE_MANIFESTS.capture_confirmation.ordered_path.map(
      (stage, index) =>
        stageEvent(stage, index + 1, {
          loop_id,
          profile: "capture_confirmation",
          intent: "capture_for_later",
          branch_scope: "single_child",
          branch_id,
          object_id,
        }),
    );
  const first = capture(LOOP_ID, PRIOR_EVENT_ID, MATERIAL_ID);
  const second = capture(
    CORRECTION_LOOP_ID,
    SECOND_BRANCH_ID,
    SECOND_OBJECT_ID,
  );
  assert.deepEqual(captureLoopTraceIssues(first), []);
  assert.deepEqual(captureLoopTraceIssues(second), []);
  assert.equal(captureLoopTraceQualifiesForNorthStar(first), false);
  assert.equal(captureLoopTraceQualifiesForNorthStar(second), false);
  assert.ok(
    captureLoopTraceIssues([
      ...first,
      stageEvent("outcome_verified", first.length + 1, {
        profile: "capture_confirmation",
        intent: "capture_for_later",
        branch_scope: "single_child",
        branch_id: PRIOR_EVENT_ID,
      }),
    ]).length > 0,
  );

  const aggregate = successfulTrace("direct_mutation", {
    intent: "complete_learning",
    object_kind: "progress_operation",
    outcome_kind: "durable_change",
    receipt_kind: "database_receipt",
    branch_scope: "multi_child_aggregate",
  });
  assert.deepEqual(captureLoopTraceIssues(aggregate), []);
  assert.equal(captureLoopTraceQualifiesForNorthStar(aggregate), false);
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
