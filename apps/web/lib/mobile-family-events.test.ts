import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  EventProps,
  MobileFamilyEventName,
} from "@homa/core";
import { CAPTURE_LOOP_EVENT_NAME } from "@homa/core";

import {
  createMobileFamilyEventHandler,
  type MobileFamilyEventDependencies,
} from "./mobile-family-events";

const FAMILY_ID = "319755d9-2df7-4b75-8470-fd9f45227b05";
const MATERIAL_ID = "fcd8c9d4-5116-4db3-94fe-11512990fb69";

function request(body: unknown): Request {
  return new Request("https://thankshoma.com/api/mobile/event", {
    method: "POST",
    headers: {
      Authorization: "Bearer verified-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function responseBody(response: Response): Promise<unknown> {
  return response.json();
}

function dependencies(overrides: Partial<MobileFamilyEventDependencies> = {}) {
  const persisted: Array<{
    name: MobileFamilyEventName;
    props: EventProps<MobileFamilyEventName>;
    familyId: string;
  }> = [];
  const value: MobileFamilyEventDependencies = {
    rateLimited: () => false,
    authenticate: async () => ({ id: FAMILY_ID }),
    persist: async (name, props, familyId) => {
      persisted.push({ name, props, familyId });
    },
    logError: () => undefined,
    ...overrides,
  };
  return { value, persisted };
}

describe("native family event relay", () => {
  it("server-stamps the authenticated family into props and row scope", async () => {
    const deps = dependencies();
    const handler = createMobileFamilyEventHandler(deps.value);
    const response = await handler(
      request({
        name: "materials.print_result",
        props: {
          material_id: MATERIAL_ID,
          outcome: "completed",
          requested_copies: 1,
          pages_selected: 2,
          answer_key_excluded: false,
        },
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await responseBody(response), { ok: true });
    assert.deepEqual(deps.persisted, [
      {
        name: "materials.print_result",
        familyId: FAMILY_ID,
        props: {
          family_id: FAMILY_ID,
          material_id: MATERIAL_ID,
          outcome: "completed",
          requested_copies: 1,
          pages_selected: 2,
          answer_key_excluded: false,
        },
      },
    ]);
  });

  it("keeps chat props family-free while scoping the database row", async () => {
    const deps = dependencies();
    const handler = createMobileFamilyEventHandler(deps.value);
    const response = await handler(
      request({
        name: "chat.turn_completed",
        props: {
          status: "ok",
          modality: "text",
          latency_ms: 420,
          model_tier: "premium",
          tool_calls: 2,
        },
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(deps.persisted, [
      {
        name: "chat.turn_completed",
        familyId: FAMILY_ID,
        props: {
          status: "ok",
          modality: "text",
          latency_ms: 420,
          model_tier: "premium",
          tool_calls: 2,
        },
      },
    ]);
  });

  it("keeps canonical loop props family-free and acknowledges the scoped row", async () => {
    const deps = dependencies();
    const handler = createMobileFamilyEventHandler(deps.value);
    const props = {
      contract_version: 1,
      event_id: "33333333-3333-4333-8333-333333333333",
      loop_id: "44444444-4444-4444-8444-444444444444",
      parent_loop_id: null,
      branch_id: null,
      branch_scope: "family",
      profile: "direct_mutation",
      intent: "complete_learning",
      stage: "entry_intent",
      sequence: 1,
      surface: "planner",
      object_kind: "plan_activity",
      object_id: "55555555-5555-4555-8555-555555555555",
      client_context: {
        client: "ios",
        app_version: "1.0.0",
        build_number: "42",
        runtime_version: "f33dd2307f31e8694a7b2727641a13a4f5f06f86",
        update_id: "019fc368-64b6-7efe-8f33-912d8c430d6f",
      },
      outcome_kind: null,
      result_state: "not_applicable",
      receipt_kind: "none",
      receipt_id: null,
      revision: null,
      revision_id: null,
      corrects_event_id: null,
      correction_result: null,
      exit_reason: null,
    } as const;
    const response = await handler(
      request({ name: CAPTURE_LOOP_EVENT_NAME, props }),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(deps.persisted, [
      {
        name: CAPTURE_LOOP_EVENT_NAME,
        familyId: FAMILY_ID,
        props,
      },
    ]);
    assert.equal("family_id" in deps.persisted[0].props, false);
  });

  it("rejects web identity and server-owned outcomes at the native boundary", async () => {
    const base = {
      contract_version: 1,
      event_id: "33333333-3333-4333-8333-333333333333",
      loop_id: "44444444-4444-4444-8444-444444444444",
      parent_loop_id: null,
      branch_id: null,
      branch_scope: "family",
      profile: "proposed_effect",
      intent: "create_material",
      stage: "outcome_verified",
      sequence: 7,
      surface: "material_card",
      object_kind: "material",
      object_id: "55555555-5555-4555-8555-555555555555",
      outcome_kind: "artifact_ready",
      result_state: "complete",
      receipt_kind: "artifact_receipt",
      receipt_id: "55555555-5555-4555-8555-555555555555",
      revision: 1,
      revision_id: "55555555-5555-4555-8555-555555555555",
      corrects_event_id: null,
      correction_result: null,
      exit_reason: null,
    } as const;
    const nativeContext = {
      client: "ios",
      app_version: "1.0.0",
      build_number: "42",
      runtime_version: "f33dd2307f31e8694a7b2727641a13a4f5f06f86",
      update_id: "019fc368-64b6-7efe-8f33-912d8c430d6f",
    } as const;
    const webContext = {
      client: "web",
      app_version: "5148f800",
      build_number: null,
      runtime_version: null,
      update_id: null,
    } as const;

    for (const client_context of [nativeContext, webContext]) {
      const deps = dependencies();
      const response = await createMobileFamilyEventHandler(deps.value)(
        request({
          name: CAPTURE_LOOP_EVENT_NAME,
          props: { ...base, client_context },
        }),
      );
      assert.equal(response.status, 400);
      assert.equal(deps.persisted.length, 0);
    }
  });

  it("fails closed for missing auth and rate limiting", async () => {
    const noAuth = dependencies({ authenticate: async () => null });
    const limited = dependencies({ rateLimited: () => true });
    const body = {
      name: "planner.device_calendar_previewed",
      props: { selected_count: 2, duplicate_count: 0 },
    };

    const noAuthResponse = await createMobileFamilyEventHandler(noAuth.value)(
      request(body),
    );
    const limitedResponse = await createMobileFamilyEventHandler(limited.value)(
      request(body),
    );

    assert.equal(noAuthResponse.status, 401);
    assert.deepEqual(await responseBody(noAuthResponse), {
      ok: false,
      reason: "no-session",
    });
    assert.equal(limitedResponse.status, 429);
    assert.equal(noAuth.persisted.length, 0);
    assert.equal(limited.persisted.length, 0);
  });

  it("rejects invalid JSON, non-allowlisted names, and malformed props", async () => {
    const deps = dependencies();
    const handler = createMobileFamilyEventHandler(deps.value);
    const badJson = new Request("https://thankshoma.com/api/mobile/event", {
      method: "POST",
      body: "{",
    });

    const responses = await Promise.all([
      handler(badJson),
      handler(request({ name: "family.invite_sent", props: {} })),
      handler(
        request({
          name: "planner.device_calendar_previewed",
          props: { selected_count: 0, duplicate_count: 0 },
        }),
      ),
    ]);

    assert.deepEqual(
      responses.map((response) => response.status),
      [400, 400, 400],
    );
    assert.deepEqual(await responseBody(responses[0]), {
      ok: false,
      reason: "bad-json",
    });
    assert.equal(deps.persisted.length, 0);
  });

  it("rejects client identity and family content fields", async () => {
    const forbiddenFields = [
      ["family_id", FAMILY_ID],
      ["user_id", "user-1"],
      ["message", "private family text"],
      ["recipient", "parent@example.com"],
    ] as const;

    for (const [field, value] of forbiddenFields) {
      const deps = dependencies();
      const response = await createMobileFamilyEventHandler(deps.value)(
        request({
          name: "materials.share_result",
          props: {
            material_id: MATERIAL_ID,
            outcome: "handed_off",
            [field]: value,
          },
        }),
      );
      assert.equal(response.status, 400, field);
      assert.equal(deps.persisted.length, 0, field);
    }
  });

  it("returns an honest failure when durable persistence fails", async () => {
    const deps = dependencies({
      persist: async () => {
        throw new Error("database unavailable");
      },
    });
    const response = await createMobileFamilyEventHandler(deps.value)(
      request({
        name: "planner.device_calendar_previewed",
        props: { selected_count: 2, duplicate_count: 1 },
      }),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await responseBody(response), {
      ok: false,
      reason: "unavailable",
    });
  });
});
