import assert from "node:assert/strict";
import test from "node:test";

import type { CaptureLoopEventProps } from "@homa/core";

import {
  createMobileCaptureLoopOutcomeHandler,
  type MobileCaptureLoopOutcomeDependencies,
} from "./mobile-capture-loop-outcome";

const FAMILY_ID = "319755d9-2df7-4b75-8470-fd9f45227b05";
const LOOP_ID = "44444444-4444-4444-8444-444444444444";
const RECEIPT_ID = "55555555-5555-4555-8555-555555555555";
const NATIVE_CONTEXT = {
  client: "ios" as const,
  app_version: "1.0.0",
  build_number: "42",
  runtime_version: "f33dd2307f31e8694a7b2727641a13a4f5f06f86",
  update_id: "019fc368-64b6-7efe-8f33-912d8c430d6f",
};

function stage(
  eventId: string,
  lifecycle: "entry_intent" | "effect_attempted",
  sequence: number,
  overrides: Partial<CaptureLoopEventProps> = {},
): CaptureLoopEventProps {
  return {
    contract_version: 1,
    event_id: eventId,
    loop_id: LOOP_ID,
    parent_loop_id: null,
    branch_id: null,
    branch_scope: "family",
    profile: "direct_mutation",
    intent: "schedule_learning",
    stage: lifecycle,
    sequence,
    surface: "planner",
    object_kind: "plan_activity",
    object_id: null,
    client_context: NATIVE_CONTEXT,
    outcome_kind: null,
    result_state: "not_applicable",
    receipt_kind: "none",
    receipt_id: null,
    revision: null,
    revision_id: null,
    corrects_event_id: null,
    correction_result: null,
    exit_reason: null,
    ...overrides,
  };
}

function request(body: unknown): Request {
  return new Request("https://thankshoma.com/api/mobile/capture-loop/outcome", {
    method: "POST",
    headers: {
      Authorization: "Bearer verified-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function dependencies(
  events: CaptureLoopEventProps[],
  overrides: Partial<MobileCaptureLoopOutcomeDependencies> = {},
) {
  const persisted: CaptureLoopEventProps[] = [];
  const value: MobileCaptureLoopOutcomeDependencies = {
    rateLimited: () => false,
    authenticate: async () => ({ id: FAMILY_ID }),
    loadEvents: async () => events,
    loadReceiptBinding: async () => true,
    persist: async (_familyId, props) => {
      persisted.push(props);
      events.push(props);
    },
    logError: () => undefined,
    ...overrides,
  };
  return { value, persisted };
}

test("server closes an eligible native Planner trace with a verified schedule receipt", async () => {
  const events = [
    stage("33333333-3333-4333-8333-333333333333", "entry_intent", 1),
    stage("33333333-3333-4333-8333-333333333334", "effect_attempted", 2),
  ];
  const deps = dependencies(events);
  const response = await createMobileCaptureLoopOutcomeHandler(deps.value)(
    request({ loop_id: LOOP_ID, receipt_id: RECEIPT_ID }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, already_recorded: false });
  assert.equal(deps.persisted.length, 1);
  assert.deepEqual(
    {
      stage: deps.persisted[0]?.stage,
      object_id: deps.persisted[0]?.object_id,
      receipt_id: deps.persisted[0]?.receipt_id,
      outcome_kind: deps.persisted[0]?.outcome_kind,
      receipt_kind: deps.persisted[0]?.receipt_kind,
    },
    {
      stage: "outcome_verified",
      object_id: RECEIPT_ID,
      receipt_id: RECEIPT_ID,
      outcome_kind: "durable_change",
      receipt_kind: "database_receipt",
    },
  );
});

test("server makes a retry idempotent for the same loop and receipt", async () => {
  const events = [
    stage("33333333-3333-4333-8333-333333333333", "entry_intent", 1),
    stage("33333333-3333-4333-8333-333333333334", "effect_attempted", 2),
    stage("33333333-3333-4333-8333-333333333335", "entry_intent", 3, {
      stage: "outcome_verified",
      object_id: RECEIPT_ID,
      outcome_kind: "durable_change",
      result_state: "complete",
      receipt_kind: "database_receipt",
      receipt_id: RECEIPT_ID,
    }),
  ];
  const deps = dependencies(events);
  const response = await createMobileCaptureLoopOutcomeHandler(deps.value)(
    request({ loop_id: LOOP_ID, receipt_id: RECEIPT_ID }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, already_recorded: true });
  assert.equal(deps.persisted.length, 0);
});

test("server reconciles an uncertain native attempt later", async () => {
  const events = [
    stage("33333333-3333-4333-8333-333333333333", "entry_intent", 1),
    stage("33333333-3333-4333-8333-333333333334", "effect_attempted", 2),
    stage("33333333-3333-4333-8333-333333333335", "entry_intent", 3, {
      stage: "outcome_uncertain",
      exit_reason: "unknown",
    }),
  ];
  const deps = dependencies(events);
  const response = await createMobileCaptureLoopOutcomeHandler(deps.value)(
    request({ loop_id: LOOP_ID, receipt_id: RECEIPT_ID }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, already_recorded: false });
  assert.equal(deps.persisted[0]?.stage, "outcome_verified");
  assert.equal(deps.persisted[0]?.sequence, 4);
});

test("a concurrent receipt claim is replay-safe", async () => {
  const events = [
    stage("33333333-3333-4333-8333-333333333333", "entry_intent", 1),
    stage("33333333-3333-4333-8333-333333333334", "effect_attempted", 2),
  ];
  const deps = dependencies(events, {
    persist: async () => {
      throw new Error("capture loop outcome receipt is already claimed");
    },
  });
  const response = await createMobileCaptureLoopOutcomeHandler(deps.value)(
    request({ loop_id: LOOP_ID, receipt_id: RECEIPT_ID }),
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    ok: false,
    reason: "receipt-already-claimed",
  });
});

test("rejects a schedule receipt that is not bound to the capture loop", async () => {
  const events = [
    stage("33333333-3333-4333-8333-333333333333", "entry_intent", 1),
    stage("33333333-3333-4333-8333-333333333334", "effect_attempted", 2),
  ];
  const deps = dependencies(events, { loadReceiptBinding: async () => false });
  const response = await createMobileCaptureLoopOutcomeHandler(deps.value)(
    request({ loop_id: LOOP_ID, receipt_id: RECEIPT_ID }),
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    ok: false,
    reason: "receipt-not-bound",
  });
  assert.equal(deps.persisted.length, 0);
});

test("rejects a client outcome, web trace, or arbitrary object", async () => {
  for (const override of [
    { profile: "proposed_effect" as const },
    { client_context: { ...NATIVE_CONTEXT, client: "web" as const, app_version: "commit", build_number: null, runtime_version: null, update_id: null } },
    { object_id: RECEIPT_ID },
  ]) {
    const events = [
      stage("33333333-3333-4333-8333-333333333333", "entry_intent", 1, override),
      stage("33333333-3333-4333-8333-333333333334", "effect_attempted", 2, override),
    ];
    const deps = dependencies(events);
    const response = await createMobileCaptureLoopOutcomeHandler(deps.value)(
      request({ loop_id: LOOP_ID, receipt_id: RECEIPT_ID }),
    );
    assert.equal(response.status, 409);
    assert.equal(deps.persisted.length, 0);
  }
});

test("fails closed for auth, rate limiting, and malformed requests", async () => {
  const events = [
    stage("33333333-3333-4333-8333-333333333333", "entry_intent", 1),
    stage("33333333-3333-4333-8333-333333333334", "effect_attempted", 2),
  ];
  const noAuth = dependencies(events, { authenticate: async () => null });
  const limited = dependencies(events, { rateLimited: () => true });
  assert.equal(
    (await createMobileCaptureLoopOutcomeHandler(noAuth.value)(request({ loop_id: LOOP_ID, receipt_id: RECEIPT_ID }))).status,
    401,
  );
  assert.equal(
    (await createMobileCaptureLoopOutcomeHandler(limited.value)(request({ loop_id: LOOP_ID, receipt_id: RECEIPT_ID }))).status,
    429,
  );
  assert.equal(
    (await createMobileCaptureLoopOutcomeHandler(dependencies(events).value)(request({ loop_id: "not-a-uuid", receipt_id: RECEIPT_ID }))).status,
    400,
  );
});
